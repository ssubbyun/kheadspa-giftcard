import { NextRequest, NextResponse } from 'next/server';
import { redeemGiftCardAsync } from '@/lib/storage';
import { verifyStaffAuth } from '@/lib/auth';
import { getErrorMessage, isValidDollarCents } from '@/lib/barcode';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };
const ALLOWED_LOCATIONS = ['Manhattan', 'Norwood', 'Fort Lee'] as const;

export async function POST(req: NextRequest) {
  try {
    const auth = verifyStaffAuth(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || '직원 인증에 실패했습니다.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();
    const { code, redeemAmount, location, staffName, staffNote } = body;

    if (!code) {
      return NextResponse.json(
        { error: '카드 번호를 입력해 주세요.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const amount = Number(redeemAmount);
    if (!isValidDollarCents(amount, 0.01, 10000)) {
      return NextResponse.json(
        { error: '올바른 차감 금액을 입력해 주세요 (최소 $0.01, 소수점 둘째 자리까지).' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
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
      return NextResponse.json(
        {
          error: result.message,
          remainingBalance: result.remainingBalance,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
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
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Error redeeming gift card:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, '차감 처리 중 오류가 발생했습니다.') },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
