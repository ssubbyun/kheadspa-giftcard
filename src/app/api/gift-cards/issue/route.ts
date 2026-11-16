import { NextRequest, NextResponse } from 'next/server';
import { calculatePromotionDiscount, issueGiftCard } from '@/lib/storage';
import { verifySucceededPaymentIntent } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      faceValue,
      buyerName,
      buyerEmail,
      recipientType,
      recipientName,
      recipientEmail,
      message,
      stripePaymentIntentId,
    } = body;

    const amount = Number(faceValue);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '유효한 금액이 아닙니다.' }, { status: 400 });
    }

    if (!buyerName || !buyerEmail) {
      return NextResponse.json({ error: '구매자 정보가 누락되었습니다.' }, { status: 400 });
    }

    if (!stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'Stripe 결제 식별자(stripePaymentIntentId)가 누락되었습니다. 결제를 먼저 완료해 주세요.' },
        { status: 400 }
      );
    }

    // 1. 서버 사이드 예상 결제 금액 산출
    const calc = calculatePromotionDiscount(amount);

    // 2. 지적사항 #1 해결: Stripe API를 직접 조회하여 실제 결제 승인(succeeded) 여부 및 결제 금액($) 일치 검증
    await verifySucceededPaymentIntent({
      paymentIntentId: stripePaymentIntentId,
      expectedChargeDollars: calc.chargeAmount,
      expectedFaceValue: calc.faceValue,
    });

    // 3. PaymentIntent 재사용(중복 발급) 검사와 함께 기프트 카드 발급
    const giftCard = await issueGiftCard({
      faceValue: calc.faceValue,
      paidAmount: calc.chargeAmount,
      buyerName,
      buyerEmail,
      recipientType: recipientType || 'self',
      recipientName,
      recipientEmail,
      message,
      stripePaymentIntentId,
    });

    return NextResponse.json({
      success: true,
      giftCard: {
        code: giftCard.code,
        initialBalance: giftCard.initialBalance,
        currentBalance: giftCard.currentBalance,
        paidAmount: giftCard.paidAmount,
        currency: giftCard.currency,
        status: giftCard.status,
        recipientName: giftCard.recipientName,
        qrCodeDataUrl: giftCard.qrCodeDataUrl,
        createdAt: giftCard.createdAt,
        expiresAt: giftCard.expiresAt,
      },
      message: '기프트 카드가 성공적으로 발급되었습니다. (유효기간: 구매일로부터 2년)',
    });
  } catch (error: any) {
    console.error('Error issuing gift card:', error);
    return NextResponse.json(
      { error: error.message || '기프트 카드 발급 중 오류가 발생했습니다.' },
      { status: 400 }
    );
  }
}
