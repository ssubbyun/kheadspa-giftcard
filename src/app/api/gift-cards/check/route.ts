import { NextRequest, NextResponse } from 'next/server';
import { getGiftCardByCodeAsync } from '@/lib/storage';

// 이름 마스킹 헬퍼 (예: "김민서" -> "김*서", "Sarah Kim" -> "Sa***m")
function maskName(name?: string): string {
  if (!name) return '고객';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(Math.min(trimmed.length - 2, 3))}${trimmed[trimmed.length - 1]}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { error: '기프트 카드 코드를 입력해 주세요.' },
      { status: 400 }
    );
  }

  try {
    const { card, transactions } = await getGiftCardByCodeAsync(code);

    if (!card) {
      return NextResponse.json(
        { error: '일치하는 기프트 카드를 찾을 수 없습니다. 16자리 번호를 다시 확인해 주세요.' },
        { status: 404 }
      );
    }

    // 지적사항 #5 해결: 개인정보(이메일, 실명 전체, 메시지, Stripe 결제 ID, 직원 실명 등)를 제거하고 잔액 확인에 필요한 최소 필드만 반환
    const safeCard = {
      code: card.code,
      initialBalance: card.initialBalance,
      currentBalance: card.currentBalance,
      currency: card.currency,
      status: card.status,
      recipientMaskedName: maskName(card.recipientName),
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
          ? '기프트 카드 충전 발급'
          : tx.staffNote || '매장 시술 차감',
      createdAt: tx.createdAt,
    }));

    return NextResponse.json({
      card: safeCard,
      transactions: safeTransactions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || '잔액 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
