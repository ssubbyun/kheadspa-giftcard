# K-HeadSpa Gift Card Test Matrix

신규 기능 개발 또는 버그 수정 시 아래 매트릭스를 기준으로 테스트 케이스 누락 여부를 점검합니다.

| ID | 영역 | 시나리오명 | 기대 결과 |
| :--- | :--- | :--- | :--- |
| `QA-01` | 프로모션 계산 | 활성 프로모션(20% OFF) 금액 산출 (`$200`, `$150`, `$99`) | `chargeAmount`가 정확히 80% 금액으로 소수점 2자리 반올림 산출 |
| `QA-02` | 1D 바코드 | `CODE128B` SVG 및 Base64 Data URL 생성 및 비ASCII 차단 | `<svg>` 및 `data:image/svg+xml;base64,` 유효 생성, 한글 등 비ASCII 입력 시 예외 발생 |
| `QA-03` | 코드 정규화 | 소문자, 하이픈 생략 16자리, `?card=` URL 입력 정규화 | 모두 표준 `KSPA-XXXX-XXXX-XXXX` 형식으로 통일 |
| `QA-04` | 전화번호 정규화 | 미국 10자리, `1`+10자리, 국제 `+82...`, 빈 문자열 | `+1XXXXXXXXXX`, `+82...`, `undefined`로 정확히 변환 |
| `QA-05` | 카드 테마 | 8종 카드 테마 조회 및 미등록 ID 폴백 | `CARD_DESIGNS` 8종 확인 및 알 수 없는 ID 시 `signature-gold` 폴백 |
| `QA-06` | 카드 발급 | `issueGiftCard` 정상 발급 및 무제한 유효기간 검증 | 코드 `KSPA-...`, `expiresAt: null`, QR URL, 1D 바코드 생성 |
| `QA-07` | 결제 재사용 방지 | 동일 `stripePaymentIntentId`로 2회 발급 시도 | 두 번째 호출에서 중복 발급 차단 예외 발생 |
| `QA-08` | 분할 차감 | 하이픈 없는 코드로 조회 후 `$150` 차감 (`$200` 원금) | `currentBalance === 50`, `status === 'ACTIVE'`, 이력 2건 기록 |
| `QA-09` | 잔액 초과 차감 | 잔액 `$50` 카드에서 `$60` 차감 요청 | `success === false`, 잔액 `$50` 그대로 보존 |
| `QA-10` | 비정상 금액 차감 | `$0` 또는 `-$50` 차감 시도 | `success === false` 거부 및 잔액 불변 |
| `QA-11` | 잔액 소진 | 남은 `$50` 전액 차감 및 이후 추가 `$1` 차감 시도 | 상태 `EXHAUSTED` 전환, 이후 추가 차감 차단 |
| `QA-12` | 무제한 유효기간 검증 | 레거시 과거 `expiresAt` 카드 조회·차감 허용 및 `CANCELLED` 상태 차단 | `expiresAt: null` & `ACTIVE` 복구, `$10` 차감 성공(`$90`), `CANCELLED` 상태 차감 거부 |
| `QA-13` | 직원 PIN 인증 | PIN 미설정, 헤더 누락, 오답 PIN, 정답 PIN(`x-staff-pin` / `Bearer`) | 미설정/누락/오답 시 `authorized: false`, 정답 시 `true` |
| `QA-14` | 무키 알림 안전성 | Resend/Twilio 키 빈 상태에서 즉시 발송 호출 | 예외 없이 `deliveryStatus === 'SKIPPED_NO_CREDENTIALS'` 반환 |
| `QA-15` | 예약 발송 | 미래 날짜(`2099-12-31`) 지정 발급 및 스케줄 조회 | `PENDING_SCHEDULED` 저장, `'2026-11-01'` 조회 미포함 / `'2099-12-31'` 조회 포함 |
| `QA-16` | PII 마스킹 감사 | 공개 조회 API(`check/route.ts` & `functions/src/index.ts`) 응답 구조 점검 | `system-invariants.json`의 금지된 PII 키 미노출 확인 |
| `QA-17` | 이중 백엔드 정합성 | 필수 6개 API 라우트 양쪽 존재 및 `no-store` 헤더 검사 | Next.js API 및 `functions/src/index.ts` 모두 경로 및 `no-store` 보유 |
| `QA-18` | 프리렌더 & 실결제 | 클라이언트 `useMemo(..., new Date)` 금지 및 Stripe `pk_live_` 허용 검사 | 위험 패턴 0건, `pk_test_` + `pk_live_` 지원 확인 |
| `QA-19` | 센트 정밀도 차감 | `0.004`, `10.999`, `NaN`, `Infinity` 차감 요청 | 모두 `success === false` 차단 및 잔액 `$100.00` 불변 |
| `QA-20` | 프로모션 동기화 | `page.tsx`, `GiftCardHero`, `GiftCardForm` 동적 프로모션 연동 | 하드코딩 `const discountRate = 20` 제거, `/api/promotions` 및 `intentData.chargeAmount` 동기화 |
| `QA-21` | 재발송 연락처 검증 | `validateResendContacts` 잘못된 이메일/전화번호 입력 검증 | 잘못된 형식 거부(`valid: false`), 빈 값 유지 허용, 정상 값 E.164 변환 |
| `QA-22` | 금액 상한 & 선물 수신자 | `create-payment-intent` & `issue` 양쪽 백엔드 `$20~$2,000` 및 `recipientEmail` 검증 | `isValidDollarCents(amount, 20, 2000)` 및 `isValidEmail` 양쪽 동기화 |
| `QA-23` | 전체 ESLint 게이트 | `pnpm lint` 실행 (`src/` 및 `functions/src/`) | ESLint 에러 및 경고 0건 (Exit Code 0) |
| `QA-24` | Stitch UI 토큰 & 안전성 | `globals.css` `--stitch-*` 토큰, `buy-section` 앵커 및 외부 CDN 스크립트 누출 점검 | 토큰·앵커 존재, `cdn.tailwindcss.com` 및 Stitch 목업 URL 누출 0건 |
| `QA-25` | 무제한 유효기간 전수 검사 | `src/` 및 `functions/src/` 내 `2년`/`2-Year` 문구 및 `new Date(...expiresAt)` 점검 | 잔존 2년 만료 문구 및 `new Date(null)` 위험 호출 0건 |
