import { NextRequest, NextResponse } from 'next/server';
import { getGiftCardByCode } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { error: '기프트 카드 코드를 입력해 주세요.' },
      { status: 400 }
    );
  }

  const { card, transactions } = getGiftCardByCode(code);

  if (!card) {
    return NextResponse.json(
      { error: '일치하는 기프트 카드를 찾을 수 없습니다. 16자리 번호를 다시 확인해 주세요.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    card,
    transactions,
  });
}
