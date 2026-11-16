import { NextRequest, NextResponse } from 'next/server';
import { issueGiftCard } from '@/lib/storage';

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

    const giftCard = await issueGiftCard({
      faceValue: amount,
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
      giftCard,
      message: '기프트 카드가 성공적으로 발급되었습니다. (유효기간: 구매일로부터 2년)',
    });
  } catch (error: any) {
    console.error('Error issuing gift card:', error);
    return NextResponse.json(
      { error: error.message || '기프트 카드 발급 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
