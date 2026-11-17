import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import crypto from 'crypto';
import {
  ACTIVE_PROMOTION,
  calculatePromotionDiscount,
  getDueScheduledGiftCardsAsync,
  getGiftCardByCodeAsync,
  getTodayEstDateString,
  issueGiftCard,
  redeemGiftCardAsync,
  updateGiftCardDeliveryAsync,
} from '../../src/lib/storage';
import {
  createStripePaymentIntent,
  verifySucceededPaymentIntent,
} from '../../src/lib/stripe';
import {
  generateCode128DataUrl,
  normalizeGiftCardCode,
  normalizeUsPhone,
} from '../../src/lib/barcode';
import { dispatchGiftCardNotifications } from '../../src/lib/notifications';

const ALLOWED_LOCATIONS = ['Manhattan', 'Norwood', 'Fort Lee'] as const;

function maskName(name?: string): string {
  if (!name) return 'Guest';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(Math.min(trimmed.length - 2, 3))}${trimmed[trimmed.length - 1]}`;
}

function getHeaderString(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function verifyStaffPin(headers: Record<string, string | string[] | undefined>): {
  authorized: boolean;
  error?: string;
} {
  const configuredPin = process.env.STAFF_PORTAL_PIN;
  if (!configuredPin || configuredPin.trim().length < 4) {
    return {
      authorized: false,
      error: '서버에 직원용 보안 PIN(STAFF_PORTAL_PIN)이 설정되어 있지 않습니다.',
    };
  }

  const xStaffPin = getHeaderString(headers['x-staff-pin']);
  const authHeader = getHeaderString(headers['authorization']);
  const headerPin = xStaffPin || authHeader.replace(/^Bearer\s+/i, '') || '';

  if (!headerPin) {
    return {
      authorized: false,
      error: '직원 인증 PIN이 필요합니다. 매장 관리자 인증 후 다시 시도해 주세요.',
    };
  }

  const expectedBuf = Buffer.from(configuredPin.trim(), 'utf-8');
  const providedBuf = Buffer.from(headerPin.trim(), 'utf-8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return {
      authorized: false,
      error: '직원 인증 PIN 번호가 올바르지 않습니다.',
    };
  }

  return { authorized: true };
}

function parseJsonBody(rawBody: unknown): Record<string, any> {
  if (typeof rawBody === 'string') {
    return JSON.parse(rawBody || '{}');
  }
  if (Buffer.isBuffer(rawBody)) {
    return JSON.parse(rawBody.toString('utf-8') || '{}');
  }
  return (rawBody as Record<string, any>) || {};
}

export const api = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const rawPath = (req.path || req.url.split('?')[0] || '').replace(/\/+$/, '');
  const route = rawPath.startsWith('/api') ? rawPath : `/api${rawPath}`;
  const method = (req.method || 'GET').toUpperCase();

  // 1. GET /api/promotions
  if (route === '/api/promotions' && method === 'GET') {
    const calc200 = calculatePromotionDiscount(200);
    res.status(200).json({
      promotion: ACTIVE_PROMOTION,
      serverTime: new Date().toISOString(),
      isPromoActive: calc200.isPromoActive,
      sampleCalculation: {
        faceValue: 200,
        chargeAmount: calc200.chargeAmount,
        discountAmount: calc200.discountAmount,
        discountRate: calc200.discountRate,
      },
    });
    return;
  }

  // 2. POST /api/create-payment-intent
  if (route === '/api/create-payment-intent' && method === 'POST') {
    try {
      const body = parseJsonBody(req.body);
      const { faceValue, buyerEmail, buyerName, recipientType, recipientName } = body;

      const amount = Number(faceValue);
      if (!amount || amount < 20 || amount > 3000) {
        res.status(400).json({ error: '유효한 금액을 입력해 주세요 ($20 ~ $3,000)' });
        return;
      }

      if (!buyerEmail || !buyerName) {
        res.status(400).json({ error: '구매자 성함과 이메일은 필수 입력 항목입니다.' });
        return;
      }

      const calculation = calculatePromotionDiscount(amount);
      const paymentIntent = await createStripePaymentIntent({
        amountInDollars: calculation.chargeAmount,
        faceValue: calculation.faceValue,
        buyerEmail,
        metadata: {
          buyerName,
          recipientType: recipientType || 'self',
          recipientName: recipientName || buyerName,
          discountRate: `${calculation.discountRate}%`,
          discountAmount: `$${calculation.discountAmount}`,
        },
      });

      res.status(200).json({
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        faceValue: calculation.faceValue,
        chargeAmount: calculation.chargeAmount,
        discountAmount: calculation.discountAmount,
        discountRate: calculation.discountRate,
        isPromoActive: calculation.isPromoActive,
      });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({
        error: error.message || 'Stripe 결제 인텐트 생성에 실패했습니다.',
      });
    }
    return;
  }

  // 3. GET /api/gift-cards/check
  if (route === '/api/gift-cards/check' && method === 'GET') {
    const queryCode = req.query?.code;
    const rawCode = Array.isArray(queryCode)
      ? String(queryCode[0] || '')
      : typeof queryCode === 'string'
        ? queryCode
        : '';
    const code = normalizeGiftCardCode(rawCode);

    if (!code) {
      res.status(400).json({ error: '기프트 카드 코드를 입력해 주세요.' });
      return;
    }

    try {
      const { card, transactions } = await getGiftCardByCodeAsync(code);

      if (!card) {
        res.status(404).json({
          error: '일치하는 기프트 카드를 찾을 수 없습니다. 16자리 번호를 다시 확인해 주세요.',
        });
        return;
      }

      const safeCard = {
        code: card.code,
        initialBalance: card.initialBalance,
        currentBalance: card.currentBalance,
        currency: card.currency,
        status: card.status,
        designId: card.designId || 'signature-gold',
        recipientMaskedName: maskName(card.recipientName),
        senderMaskedName: maskName(card.buyerName),
        qrCodeDataUrl: card.qrCodeDataUrl,
        barcodeDataUrl: card.barcodeDataUrl || generateCode128DataUrl(card.code),
        deliveryStatus: card.deliveryStatus,
        scheduledDeliveryDate: card.scheduledDeliveryDate,
        createdAt: card.createdAt,
        expiresAt: card.expiresAt,
      };

      const safeTransactions = transactions.map((tx) => ({
        id: tx.id,
        transactionType: tx.transactionType,
        amount: tx.amount,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        location: tx.location,
        summary:
          tx.transactionType === 'INITIAL_PURCHASE'
            ? 'Gift Card Issued / 기프트 카드 충전 발급'
            : tx.staffNote || 'Spa Service Redemption / 매장 시술 차감',
        createdAt: tx.createdAt,
      }));

      res.status(200).json({
        card: safeCard,
        transactions: safeTransactions,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || '잔액 조회 중 오류가 발생했습니다.',
      });
    }
    return;
  }

  // 4. POST /api/gift-cards/issue
  if (route === '/api/gift-cards/issue' && method === 'POST') {
    try {
      const body = parseJsonBody(req.body);
      const {
        faceValue,
        designId,
        buyerName,
        buyerEmail,
        buyerPhone,
        recipientType,
        recipientName,
        recipientEmail,
        recipientPhone,
        message,
        scheduledDeliveryDate,
        stripePaymentIntentId,
      } = body;

      const amount = Number(faceValue);
      if (!amount || amount <= 0) {
        res.status(400).json({ error: '유효한 금액이 아닙니다.' });
        return;
      }

      if (!buyerName || !buyerEmail) {
        res.status(400).json({ error: '구매자 정보가 누락되었습니다.' });
        return;
      }

      if (!stripePaymentIntentId) {
        res.status(400).json({
          error: 'Stripe 결제 식별자(stripePaymentIntentId)가 누락되었습니다. 결제를 먼저 완료해 주세요.',
        });
        return;
      }

      const calc = calculatePromotionDiscount(amount);

      await verifySucceededPaymentIntent({
        paymentIntentId: stripePaymentIntentId,
        expectedChargeDollars: calc.chargeAmount,
        expectedFaceValue: calc.faceValue,
      });

      const giftCard = await issueGiftCard({
        faceValue: calc.faceValue,
        paidAmount: calc.chargeAmount,
        designId,
        buyerName,
        buyerEmail,
        buyerPhone: normalizeUsPhone(buyerPhone),
        recipientType: recipientType || 'self',
        recipientName,
        recipientEmail,
        recipientPhone: normalizeUsPhone(recipientPhone),
        message,
        scheduledDeliveryDate,
        stripePaymentIntentId,
      });

      let delivery: Awaited<ReturnType<typeof dispatchGiftCardNotifications>> | null = null;
      try {
        delivery = await dispatchGiftCardNotifications(giftCard);
      } catch (dispatchErr) {
        console.error('Non-fatal notification dispatch error:', dispatchErr);
      }

      res.status(200).json({
        success: true,
        giftCard: {
          code: giftCard.code,
          initialBalance: giftCard.initialBalance,
          currentBalance: giftCard.currentBalance,
          paidAmount: giftCard.paidAmount,
          currency: giftCard.currency,
          status: giftCard.status,
          designId: giftCard.designId || 'signature-gold',
          recipientName: giftCard.recipientName,
          qrCodeDataUrl: giftCard.qrCodeDataUrl,
          barcodeDataUrl: giftCard.barcodeDataUrl,
          scheduledDeliveryDate: giftCard.scheduledDeliveryDate,
          deliveryStatus: delivery?.deliveryStatus || giftCard.deliveryStatus,
          createdAt: giftCard.createdAt,
          expiresAt: giftCard.expiresAt,
        },
        delivery,
        message: '기프트 카드가 성공적으로 발급되었습니다. (유효기간: 구매일로부터 2년)',
      });
    } catch (error: any) {
      console.error('Error issuing gift card:', error);
      res.status(400).json({
        error: error.message || '기프트 카드 발급 중 오류가 발생했습니다.',
      });
    }
    return;
  }

  // 5. POST /api/gift-cards/redeem
  if (route === '/api/gift-cards/redeem' && method === 'POST') {
    try {
      const auth = verifyStaffPin(req.headers);
      if (!auth.authorized) {
        res.status(401).json({
          error: auth.error || '직원 인증에 실패했습니다.',
        });
        return;
      }

      const body = parseJsonBody(req.body);
      const { code, redeemAmount, location, staffName, staffNote } = body;

      if (!code) {
        res.status(400).json({ error: '카드 번호를 입력해 주세요.' });
        return;
      }

      const amount = Number(redeemAmount);
      if (!amount || amount <= 0) {
        res.status(400).json({ error: '올바른 차감 금액을 입력해 주세요.' });
        return;
      }

      const validLocation = ALLOWED_LOCATIONS.includes(location) ? location : 'Manhattan';
      const sanitizedStaffName = (staffName || '').trim() || 'Authorized Staff';

      const result = await redeemGiftCardAsync({
        code,
        redeemAmount: amount,
        location: validLocation,
        staffName: sanitizedStaffName,
        staffNote,
      });

      if (!result.success) {
        res.status(400).json({
          error: result.message,
          remainingBalance: result.remainingBalance,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        card: result.card
          ? {
              code: result.card.code,
              initialBalance: result.card.initialBalance,
              currentBalance: result.card.currentBalance,
              status: result.card.status,
              designId: result.card.designId || 'signature-gold',
              recipientName: result.card.recipientName,
              expiresAt: result.card.expiresAt,
            }
          : undefined,
        remainingBalance: result.remainingBalance,
      });
    } catch (error: any) {
      console.error('Error redeeming gift card:', error);
      res.status(500).json({
        error: error.message || '차감 처리 중 오류가 발생했습니다.',
      });
    }
    return;
  }

  // 6. POST /api/gift-cards/resend
  if (route === '/api/gift-cards/resend' && method === 'POST') {
    try {
      const auth = verifyStaffPin(req.headers);
      if (!auth.authorized) {
        res.status(401).json({
          error: auth.error || '직원 인증에 실패했습니다.',
        });
        return;
      }

      const body = parseJsonBody(req.body);
      const code = normalizeGiftCardCode(body?.code || '');
      const recipientEmail =
        typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
      const recipientPhone =
        typeof body?.recipientPhone === 'string'
          ? normalizeUsPhone(body.recipientPhone)
          : undefined;

      if (!code) {
        res.status(400).json({ error: '기프트 카드 코드를 입력해 주세요.' });
        return;
      }

      const { card } = await getGiftCardByCodeAsync(code);
      if (!card) {
        res.status(404).json({ error: '일치하는 기프트 카드를 찾을 수 없습니다.' });
        return;
      }

      let targetCard = card;
      if (recipientEmail || recipientPhone) {
        const updated = await updateGiftCardDeliveryAsync(code, {
          ...(recipientEmail ? { recipientEmail } : {}),
          ...(recipientPhone ? { recipientPhone } : {}),
        });
        if (updated) {
          targetCard = updated;
        }
      }

      const delivery = await dispatchGiftCardNotifications(targetCard, { forceImmediate: true });

      res.status(200).json({
        success: true,
        code: targetCard.code,
        delivery,
      });
    } catch (error: any) {
      console.error('Error resending gift card notifications:', error);
      res.status(500).json({
        error: error.message || '바우처 재발송 중 오류가 발생했습니다.',
      });
    }
    return;
  }

  res.status(404).json({ error: 'Not Found' });
});

export const scheduledGiftCardDelivery = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async () => {
    const todayEst = getTodayEstDateString();
    const dueCards = await getDueScheduledGiftCardsAsync(todayEst);

    for (const card of dueCards) {
      try {
        await dispatchGiftCardNotifications(card, { forceImmediate: true });
      } catch (err) {
        console.error(`Failed scheduled delivery for ${card.code}:`, err);
      }
    }
  }
);
