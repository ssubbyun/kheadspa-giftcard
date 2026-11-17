# K-headspa & wellness 디지털 기프트 카드 시스템

손은숙 부장님의 요청에 따라 구축된 **K-headspa & wellness 전용 디지털 기프트 카드 독립 웹 애플리케이션**입니다.

## 🌟 주요 구현 기능

1. **Stripe Test API 기반 자체 결제 및 즉시 발급**:
   - $100, $200, $300, $500 및 직접 입력 지원
   - 나에게 보내기 / 선물하기 (축하 메시지 포함)
   - 결제 즉시 16자리 고유 암호화 코드(`KSPA-XXXX-XXXX-XXXX`) 및 QR 코드 발급
2. **유효기간 무제한 (No Expiration)**:
   - 만료일 및 휴면 수수료 없이 잔액 소진 시까지 전 지점 분할 사용 지원 (`expiresAt: null`)
3. **기간 한정 20% 프로모션 할인 결제 엔진 (Dual-Amount Architecture)**:
   - 11월 30일까지 20% 특별 할인 (예: $200 액면가 충전 시 실제 결제액은 $160)
   - 클라이언트 변조 방지를 위한 서버 사이드 결제 금액 재검증
4. **상단 프로모션 카운트다운 배너**:
   - 11월 30일 23:59:59 EST 마감 실시간 카운트다운 타이머 탑재
5. **실시간 잔액 추적 (Balance Tracking) & 매장 차감(Redeem) POS**:
   - **고객용**: 16자리 코드 입력 시 현재 남은 잔액, 원금, 유효기간, 사용 내역 실시간 조회
   - **매장 직원용**: Manhattan, Norwood, Fort Lee 3개 지점 선택, 시술 금액 입력 후 즉시 차감

---

## 🚀 배포 가이드 (`gift.kheadspawellness.com`)

### 1. Vercel 원클릭 배포
1. 본 리포지토리를 GitHub에 푸시합니다.
2. [Vercel](https://vercel.com)에 로그인 후 새 프로젝트로 임포트합니다.
3. **Environment Variables** 설정:
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (Stripe 대시보드의 Publishable Key)
   STRIPE_SECRET_KEY=sk_test_... (Stripe 대시보드의 Secret Key)
   NEXT_PUBLIC_APP_URL=https://gift.kheadspawellness.com
   ```
4. **Domains** 설정에서 `gift.kheadspawellness.com`을 등록합니다.

### 2. DNS 설정 (도메인 등록업체 - Cloudflare, GoDaddy 등)
- **Type**: `CNAME`
- **Name (Host)**: `gift`
- **Value (Target)**: `cname.vercel-dns.com`

### 3. 기존 공식 홈페이지 연동
- [kheadspawellness.com](https://kheadspawellness.com)의 헤더/푸터 "Gift Card" 버튼 링크를 `https://gift.kheadspawellness.com`으로 연결하면 완료됩니다.
