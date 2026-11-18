# K-HeadSpa 환경 분리 및 운영 가이드 (Local / Staging / Production)

본 프로젝트는 **결제 및 잔액 데이터 격리**를 위해 **로컬 개발(`development`)**, **테스트/스테이징(`staging`)**, **실운영(`production`)** 3개 환경이 완전히 분리되어 있습니다.

---

## 1. 환경별 구성 요약

| 항목 | 로컬 개발 (`pnpm dev`) | 스테이징 테스트 (`staging`) | 실운영 프로덕션 (`production`) |
| :--- | :--- | :--- | :--- |
| **Firebase 프로젝트** | 없음 (로컬 JSON) | `kheadspa-giftcard-staging` | `kheadspa-giftcard` |
| **환경 설정 파일** | `.env.local` | `.env.staging` | `.env.production` |
| **도메인 URL** | `http://localhost:3000` | `https://kheadspa-giftcard-staging.web.app` | `https://gift.kheadspawellness.com` |
| **카드 코드 접두어** | `TEST-XXXX-XXXX-XXXX` | `TEST-XXXX-XXXX-XXXX` | `KSPA-XXXX-XXXX-XXXX` |
| **교차 환경 차단** | `TEST-` 전용 | `KSPA-` 실운영 카드 차단 | `TEST-` 테스트 카드 차단 |
| **데모 결제 스위치** | 허용 (`ALLOW_DEMO_CHECKOUT=true`) | 허용 (`ALLOW_DEMO_CHECKOUT=true`) | **코드 레벨 영구 차단** |
| **상단 헤더 배지** | `DEV · TEST` | `STAGING · TEST` | 표시 안 함 (고객용 클린 UI) |
| **이메일 제목** | `[TEST] ...` | `[TEST] ...` | 정식 제목 |

---

## 2. 자주 쓰는 명령어

- **로컬 개발 테스트**:
  ```bash
  pnpm dev
  ```
- **스테이징 서버 빌드 & 배포**:
  ```bash
  pnpm deploy:staging
  ```
- **스테이징 테스트 DB 전체 초기화**:
  ```bash
  pnpm db:reset-staging
  ```
- **실운영 서버 빌드 & 배포**:
  ```bash
  pnpm deploy:prod
  ```
- **전체 품질/회귀 테스트**:
  ```bash
  pnpm qa
  ```

> `.firebaserc`의 `default` 별칭은 실수 방지를 위해 `kheadspa-giftcard-staging`을 가리킵니다. 실운영 배포는 반드시 `pnpm deploy:prod`를 사용하세요.

---

## 3. 실운영 오픈(Go-Live) 직전 체크리스트

[`.env.production`](.env.production) ([`.env.production.example`](.env.production.example) 참조)에 아래 실운영 키를 입력한 뒤 `pnpm deploy:prod`를 실행하면 즉시 실결제 운영으로 전환됩니다.

1. **Stripe 실결제 키**:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `STRIPE_SECRET_KEY=sk_live_...`
2. **매장 직원 POS PIN 변경**:
   - `STAFF_PORTAL_PIN=` 기본값(`1234`) 대신 매장 전용 4~8자리 숫자로 변경
3. **이메일(Resend) & SMS(Twilio) 실운영 키** *(선택/권장)*:
   - `RESEND_API_KEY=re_...`
   - `TWILIO_ACCOUNT_SID=AC...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_FROM_NUMBER=+1...`

---

## 4. 스테이징 커스텀 도메인 연결 (선택 사항)

원하실 경우 `gift-dev.kheadspawellness.com`도 Cloudflare + Firebase Hosting으로 연결할 수 있습니다.
1. Firebase Console → `kheadspa-giftcard-staging` → **Hosting → Add custom domain** (`gift-dev.kheadspawellness.com`)
2. Cloudflare DNS → `CNAME` · Name: `gift-dev` · Target: `kheadspa-giftcard-staging.web.app` · **DNS only (회색 구름)**
3. `.env.staging`의 `NEXT_PUBLIC_APP_URL=https://gift-dev.kheadspawellness.com` 수정 후 `pnpm deploy:staging` 실행
