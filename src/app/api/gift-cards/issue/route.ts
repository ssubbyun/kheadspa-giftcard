import { NextRequest, NextResponse } from 'next/server';
import { calculatePromotionDiscount, issueGiftCard } from '@/lib/storage';
import { verifySucceededPaymentIntent } from '@/lib/stripe';
import { dispatchGiftCardNotifications } from '@/lib/notifications';
import {
  getErrorMessage,
  isValidDollarCents,
  isValidEmail,
  normalizeUsPhone,
} from '@/lib/barcode';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    if (!isValidDollarCents(amount, 20, 2000)) {
      return NextResponse.json(
        { error: '유효한 금액이 아닙니다 ($20 ~ $2,000).' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!buyerName || !String(buyerName).trim() || !isValidEmail(buyerEmail)) {
      return NextResponse.json(
        { error: '구매자 정보가 누락되었거나 이메일 형식이 올바르지 않습니다.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (
      recipientType === 'gift' &&
      (!recipientName || !String(recipientName).trim() || !isValidEmail(recipientEmail))
    ) {
      return NextResponse.json(
        { error: '선물 받을 분의 성함과 유효한 이메일을 입력해 주세요.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'Stripe 결제 식별자(stripePaymentIntentId)가 누락되었습니다. 결제를 먼저 완료해 주세요.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 1. 서버 사이드 예상 결제 금액 산출
    const calc = calculatePromotionDiscount(amount);

    // 2. Stripe API 직접 조회하여 실제 결제 승인(succeeded) 여부 및 결제 금액 일치 검증
    await verifySucceededPaymentIntent({
      paymentIntentId: stripePaymentIntentId,
      expectedChargeDollars: calc.chargeAmount,
      expectedFaceValue: calc.faceValue,
    });

    // 3. PaymentIntent 재사용(중복 발급) 검사와 함께 기프트 카드 발급
    const giftCard = await issueGiftCard({
      faceValue: calc.faceValue,
      paidAmount: calc.chargeAmount,
      designId,
      buyerName: String(buyerName).trim(),
      buyerEmail: String(buyerEmail).trim(),
      buyerPhone: normalizeUsPhone(buyerPhone),
      recipientType: recipientType || 'self',
      recipientName: recipientName ? String(recipientName).trim() : undefined,
      recipientEmail: recipientEmail ? String(recipientEmail).trim() : undefined,
      recipientPhone: normalizeUsPhone(recipientPhone),
      message,
      scheduledDeliveryDate,
      stripePaymentIntentId,
    });

    // 4. 이메일 + SMS 발송 시도 (키 미설정 또는 실패해도 발급 자체는 정상 완료)
    let delivery: Awaited<ReturnType<typeof dispatchGiftCardNotifications>> | null = null;
    try {
      delivery = await dispatchGiftCardNotifications(giftCard);
    } catch (dispatchErr) {
      console.error('Non-fatal notification dispatch error:', dispatchErr);
    }

    return NextResponse.json(
      {
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
          expiresAt: null,
        },
        delivery,
        message: '기프트 카드가 성공적으로 발급되었습니다. (유효기간: 무제한)',
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Error issuing gift card:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, '기프트 카드 발급 중 오류가 발생했습니다.') },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
