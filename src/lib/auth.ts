import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * 매장 직원(Staff) 인증 검증 모듈 (지적사항 #2 해결)
 * - 요청 헤더 `x-staff-pin` 또는 `Authorization: Bearer <PIN>`을 서버의 `STAFF_PORTAL_PIN` 환경변수와 타이밍 안전 비교(Timing-safe equal)로 검증합니다.
 */
export function verifyStaffAuth(req: NextRequest): {
  authorized: boolean;
  error?: string;
} {
  const configuredPin = process.env.STAFF_PORTAL_PIN;
  if (!configuredPin || configuredPin.trim().length < 4) {
    return {
      authorized: false,
      error: '서버에 직원용 보안 PIN(STAFF_PORTAL_PIN)이 설정되어 있지 않습니다.',
    };
  }

  const headerPin =
    req.headers.get('x-staff-pin') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerPin) {
    return {
      authorized: false,
      error: '직원 인증 PIN이 필요합니다. 매장 관리자 인증 후 다시 시도해 주세요.',
    };
  }

  const expectedBuf = Buffer.from(configuredPin.trim(), 'utf-8');
  const providedBuf = Buffer.from(headerPin.trim(), 'utf-8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return {
      authorized: false,
      error: '직원 인증 PIN 번호가 올바르지 않습니다.',
    };
  }

  return { authorized: true };
}
