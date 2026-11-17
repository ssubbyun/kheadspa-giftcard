# K-HeadSpa Gift Card Test Matrix

신규 기능 개발 또는 버그 수정 시 아래 매트릭스를 기준으로 테스트 케이스 누락 여부를 점검합니다.

| ID | 영역 | 시나리오명 | 기대 결과 |
| :--- | :--- | :--- | :--- |
| `QA-01` | 프로모션 계산 | 활성 프로모션(20% OFF) 금액 산출 (`$200`, `$150`, `$99`) | `chargeAmount`가 정확히 80% 금액으로 소수점 2자리 반올림 산출 |
| `QA-02` | 1D 바코드 | `CODE128B` SVG 및 Base64 Data URL 생성 및 비ASCII 차단 | `<svg>` 및 `data:image/svg+xml;base64,` 유효 생성, 한글 등 비ASCII 입력 시 예외 발생 |
| `QA-03` | 코드 정규화 | 소문자, 하이픈 생략 16자리, `?card=` URL 입력 정규화 | 모두 표준 `KSPA-XXXX-XXXX-XXXX` 형식으로 통일 |
| `QA-04` | 전화번호 정규화 | 미국 10자리, `1`+10자리, 국제 `+82...`, 빈 문자열 | `+1XXXXXXXXXX`, `+82...`, `undefined`로 정확히 변환 |
| `QA-05` | 카드 테마 | 8종 카드 테마 조회 및 미등록 ID 폴백 | `CARD_DESIGNS` 8종 확인 및 알 수 없는 ID 시 `signature-gold` 폴백 |
| `QA-06` | 카드 발급 | `issueGiftCard` 정상 발급 및 메타데이터 검증 | 코드 `KSPA-...`, 2년 뒤 `expiresAt`, QR URL, 1D 바코드 생성 |
| `QA-07` | 결제 재사용 방지 | 동일 `stripePaymentIntentId`로 2회 발급 시도 | 두 번째 호출에서 중복 발급 차단 예외 발생 |
| `QA-08` | 분할 차감 | 하이픈 없는 코드로 조회 후 `$150` 차감 (`$200` 원금) | `currentBalance === 50`, `status === 'ACTIVE'`, 이력 2건 기록 |
| `QA-09` | 잔액 초과 차감 | 잔액 `$50` 카드에서 `$60` 차감 요청 | `success === false`, 잔액 `$50` 그대로 보존 |
| `QA-10` | 비정상 금액 차감 | `$0` 또는 `-$50` 차감 시도 | `success === false` 거부 및 잔액 불변 |
| `QA-11` | 잔액 소진 | 남은 `$50` 전액 차감 및 이후 추가 `$1` 차감 시도 | 상태 `EXHAUSTED` 전환, 이후 추가 차감 차단 |
| `QA-12` | 유효기간 만료 | `expiresAt`이 과거로 지난 카드 조회 및 차감 시도 | 조회 시 상태 `EXPIRED` 자동 전환, 차감 시 거부 |
| `QA-13` | 직원 PIN 인증 | PIN 미설정, 헤더 누락, 오답 PIN, 정답 PIN(`x-staff-pin` / `Bearer`) | 미설정/누락/오답 시 `authorized: false`, 정답 시 `true` |
| `QA-14` | 무키 알림 안전성 | Resend/Twilio 키 빈 상태에서 즉시 발송 호출 | 예외 없이 `deliveryStatus === 'SKIPPED_NO_CREDENTIALS'` 반환 |
| `QA-15` | 예약 발송 | 미래 날짜(`2099-12-31`) 지정 발급 및 스케줄 조회 | `PENDING_SCHEDULED` 저장, `'2026-11-01'` 조회 미포함 / `'2099-12-31'` 조회 포함 |
| `QA-16` | PII 마스킹 감사 | 공개 조회 API(`check/route.ts` & `functions/src/index.ts`) 응답 구조 점검 | `system-invariants.json`의 금지된 PII 키 미노출 확인 |
| `QA-17` | 이중 백엔드 정합성 | 필수 6개 API 라우트 양쪽 존재 및 `no-store` 헤더 검사 | Next.js API 및 `functions/src/index.ts` 모두 경로 및 `no-store` 보유 |
| `QA-18` | 프리렌더 & 실결제 | 클라이언트 `useMemo(..., new Date)` 금지 및 Stripe `pk_live_` 허용 검사 | 위험 패턴 0건, `pk_test_` + `pk_live_` 지원 확인 |
