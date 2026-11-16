import { NextRequest, NextResponse } from 'next/server';
import { calculatePromotionDiscount } from '@/lib/storage';
import { createStripePaymentIntent } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { faceValue, buyerEmail, buyerName, recipientType, recipientName } = body;

    const amount = Number(faceValue);
    if (!amount || amount < 20 || amount > 3000) {
      return NextResponse.json(
        { error: '유효한 금액을 입력해 주세요 ($20 ~ $3,000)' },
        { status: 400 }
      );
    }

    if (!buyerEmail || !buyerName) {
      return NextResponse.json(
        { error: '구매자 성함과 이메일은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 서버 사이드 프로모션 할인 재계산 (클라이언트 변조 원천 차단)
    const calculation = calculatePromotionDiscount(amount);

    // Stripe PaymentIntent 생성
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

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      faceValue: calculation.faceValue,
      chargeAmount: calculation.chargeAmount,
      discountAmount: calculation.discountAmount,
      discountRate: calculation.discountRate,
      isPromoActive: calculation.isPromoActive,
      isMock: paymentIntent.isMock,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || '결제 인텐트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
