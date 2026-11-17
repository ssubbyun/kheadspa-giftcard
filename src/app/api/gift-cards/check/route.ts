import { NextRequest, NextResponse } from 'next/server';
import { getGiftCardByCodeAsync } from '@/lib/storage';
import { generateCode128DataUrl, getErrorMessage, normalizeGiftCardCode } from '@/lib/barcode';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

// 이름 마스킹 헬퍼 (예: "김민서" -> "김*서", "Sarah Kim" -> "Sa***m")
function maskName(name?: string): string {
  if (!name) return 'Guest';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(Math.min(trimmed.length - 2, 3))}${trimmed[trimmed.length - 1]}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCode = searchParams.get('code');
  const code = normalizeGiftCardCode(rawCode || '');

  if (!code) {
    return NextResponse.json(
      { error: '기프트 카드 코드를 입력해 주세요.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const { card, transactions } = await getGiftCardByCodeAsync(code);

    if (!card) {
      return NextResponse.json(
        { error: '일치하는 기프트 카드를 찾을 수 없습니다. 16자리 번호를 다시 확인해 주세요.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    // 개인정보(이메일, 전화번호, 실명 전체, 메시지 등)를 마스킹/제외하고 바우처 및 잔액 확인 필드만 반환
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
      expiresAt: null,
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

    return NextResponse.json(
      {
        card: safeCard,
        transactions: safeTransactions,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, '잔액 조회 중 오류가 발생했습니다.') },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
