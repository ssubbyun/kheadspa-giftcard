import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffAuth } from '@/lib/auth';
import { getGiftCardByCodeAsync, updateGiftCardDeliveryAsync } from '@/lib/storage';
import { dispatchGiftCardNotifications } from '@/lib/notifications';
import { normalizeGiftCardCode, normalizeUsPhone } from '@/lib/barcode';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

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
    const code = normalizeGiftCardCode(body?.code || '');
    const recipientEmail = typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
    const recipientPhone = typeof body?.recipientPhone === 'string' ? normalizeUsPhone(body.recipientPhone) : undefined;

    if (!code) {
      return NextResponse.json(
        { error: '기프트 카드 코드를 입력해 주세요.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { card } = await getGiftCardByCodeAsync(code);
    if (!card) {
      return NextResponse.json(
        { error: '일치하는 기프트 카드를 찾을 수 없습니다.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    let targetCard = card;
    if (recipientEmail || recipientPhone) {
      const updated = await updateGiftCardDeliveryAsync(code, {
        ...(recipientEmail ? { recipientEmail } : {}),
        ...(recipientPhone ? { recipientPhone } : {}),
      });
      if (updated) {
        targetCard = updated;
      }
    }

    const delivery = await dispatchGiftCardNotifications(targetCard, { forceImmediate: true });

    return NextResponse.json(
      {
        success: true,
        code: targetCard.code,
        delivery,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    console.error('Error resending gift card notifications:', error);
    return NextResponse.json(
      { error: error.message || '바우처 재발송 중 오류가 발생했습니다.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
