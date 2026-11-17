import { NextRequest, NextResponse } from 'next/server';
import { calculatePromotionDiscount } from '@/lib/storage';
import { createStripePaymentIntent } from '@/lib/stripe';
import { getErrorMessage, isValidDollarCents, isValidEmail } from '@/lib/barcode';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      faceValue,
      buyerEmail,
      buyerName,
      recipientType,
      recipientName,
      recipientEmail,
      demoMode,
    } = body;

    const amount = Number(faceValue);
    if (!isValidDollarCents(amount, 20, 2000)) {
      return NextResponse.json(
        { error: '유효한 금액을 입력해 주세요 ($20 ~ $2,000)' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!buyerName || !String(buyerName).trim() || !isValidEmail(buyerEmail)) {
      return NextResponse.json(
        { error: '구매자 성함과 유효한 이메일은 필수 입력 항목입니다.' },
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

    // 서버 사이드 프로모션 할인 재계산
    const calculation = calculatePromotionDiscount(amount);
    const requestedDemoMode = Boolean(demoMode);

    // 실제 Stripe PaymentIntent 또는 허용된 데모 결제 인텐트 생성
    const paymentIntent = await createStripePaymentIntent({
      amountInDollars: calculation.chargeAmount,
      faceValue: calculation.faceValue,
      buyerEmail: String(buyerEmail).trim(),
      demoMode: requestedDemoMode,
      metadata: {
        buyerName: String(buyerName).trim(),
        recipientType: recipientType || 'self',
        recipientName: String(recipientName || buyerName).trim(),
        discountRate: `${calculation.discountRate}%`,
        discountAmount: `$${calculation.discountAmount}`,
      },
    });

    return NextResponse.json(
      {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        demoMode: Boolean(paymentIntent.demoMode),
        faceValue: calculation.faceValue,
        chargeAmount: calculation.chargeAmount,
        discountAmount: calculation.discountAmount,
        discountRate: calculation.discountRate,
        isPromoActive: calculation.isPromoActive,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Stripe 결제 인텐트 생성에 실패했습니다.') },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
