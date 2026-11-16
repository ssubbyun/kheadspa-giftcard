import { NextRequest, NextResponse } from 'next/server';
import { redeemGiftCard } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, redeemAmount, location, staffName, staffNote } = body;

    if (!code) {
      return NextResponse.json({ error: '카드 번호를 입력해 주세요.' }, { status: 400 });
    }

    const amount = Number(redeemAmount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '올바른 차감 금액을 입력해 주세요.' }, { status: 400 });
    }

    const result = redeemGiftCard({
      code,
      redeemAmount: amount,
      location: location || 'Manhattan',
      staffName: staffName || 'Staff',
      staffNote,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, card: result.card },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      card: result.card,
      remainingBalance: result.remainingBalance,
    });
  } catch (error: any) {
    console.error('Error redeeming gift card:', error);
    return NextResponse.json(
      { error: error.message || '차감 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
