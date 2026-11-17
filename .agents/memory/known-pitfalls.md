# K-HeadSpa Known Pitfalls & Anti-Repeat Ledger

이 문서는 본 프로젝트(`kheadspa-giftcard`)에서 과거에 실제로 발생했거나 검증 과정에서 발견된 기술적 함정과 해결 패턴을 영구 기록합니다.
**모든 디버깅 및 코드 수정 작업 전 반드시 이 문서를 먼저 확인하세요.**

---

## PITFALL-001: Next.js 16 `cacheComponents: true` 환경에서 클라이언트 컴포넌트 프리렌더 `new Date()` / `window` 오류
- **증상**: `next build` 중 `/` 정적 프리렌더링 단계에서 `Error: Route "/": Next.js encountered the unstable value new Date() in a Client Component.` 에러로 빌드 중단.
- **근본 원인**: `next.config.mjs`에 `cacheComponents: true`가 활성화되어 있어, `'use client'` 컴포넌트라도 렌더링 본문(또는 `useMemo` 초기 실행)에서 `new Date()`나 `window`를 동기적으로 읽으면 프리렌더가 실패함.
- **절대 금지**: 클라이언트 컴포넌트 렌더 본문 또는 `useMemo` 내부에서 `new Date()`, `Date.now()`, `window.*` 직접 호출 금지.
- **올바른 패턴**: 초기 상태를 빈 문자열/고정값으로 두고 `useEffect(() => { ... }, [])` 또는 이벤트 핸들러 내부에서만 날짜/브라우저 API 읽기 (`GiftCardHero.tsx`, `GiftCardForm.tsx`, `PromotionBanner.tsx`, `page.tsx` 참조).
- **회귀 테스트 ID**: `QA-18`

---

## PITFALL-002: 이중 백엔드 불일치 (`src/app/api/**` ↔ `functions/src/index.ts`)
- **증상**: 로컬 `pnpm dev`에서는 정상 동작하지만 Firebase 배포 서버(`kheadspa-giftcard.web.app/api/*`)에서는 구버전 로직이나 404/오류가 발생.
- **근본 원인**: Firebase Hosting은 `.firebase-public`의 정적 파일과 `functions/src/index.ts` Cloud Functions v2(`api`)로 `/api/**` 요청을 처리하는 반면, 로컬 `pnpm dev`는 `src/app/api/**/route.ts`를 사용함.
- **절대 금지**: `src/app/api/**`만 수정하고 `functions/src/index.ts`를 업데이트하지 않는 편측 수정 금지 (또는 그 반대).
- **올바른 패턴**: API 엔드포인트 추가/수정 시 반드시 `src/app/api/**`와 `functions/src/index.ts` 양쪽의 요청 파싱, 검증, 마스킹, 응답 스펙, `Cache-Control` 헤더를 100% 동일하게 동기화.
- **회귀 테스트 ID**: `QA-17`, `verify-fix-safety.mjs`

---

## PITFALL-003: 이중 스토리지 격리 원칙 위반 및 Firestore 복합 인덱스 의존
- **증상**: Firestore 장애 시 로컬 JSON으로 조용히 넘어가 데이터 정합성이 깨지거나, Cloud Functions 런타임에서 `FAILED_PRECONDITION: The query requires an index` 에러 발생.
- **근본 원인**: `storage.ts`의 로컬 파일 저장소와 `firebase.ts`의 Firestore 저장소가 혼용되거나, `.where().orderBy()` 조합 쿼리에 복합 인덱스가 누락됨.
- **절대 금지**:
  - Firebase 설정 환경에서 로컬 JSON 파일(`data/gift_cards_store.json`)로 하이브리드 Fallback 금지.
  - 사전 배포되지 않은 Firestore 복합 인덱스(`.where(...) + .orderBy(...)` 또는 다중 `.where(...)`) 추가 금지.
- **올바른 패턴**: `isFirebaseConfigured()`가 `true`이면 오직 Firestore만 사용하고 실패 시 즉시 예외 반환. 조회 시 단일 필드 `.where()` 쿼리 후 메모리 정렬(`src/lib/firebase.ts`의 `getTransactionsFromFirebase`, `getPendingScheduledCardsFromFirebase` 참조).
- **회귀 테스트 ID**: `QA-06` ~ `QA-12`, `QA-15`

---

## PITFALL-004: Google Frontend CDN에 의한 동적 API 응답 캐싱
- **증상**: 기프트 카드 잔액을 차감하거나 발급한 직후 조회 API(`/api/gift-cards/check`)를 호출해도 CDN이 이전 응답을 최대 600초간 캐싱하여 옛 잔액이 반환됨.
- **근본 원인**: Firebase Hosting 뒤의 Google Frontend가 `Cache-Control` 헤더가 없거나 허용된 응답을 캐싱할 수 있음.
- **절대 금지**: 동적 API 응답을 기본 헤더 상태로 반환 금지.
- **올바른 패턴**: Next.js Route Handlers와 `functions/src/index.ts` 모든 API 응답에 `Cache-Control: no-store, no-cache, must-revalidate` 헤더 명시.
- **회귀 테스트 ID**: `QA-17`

---

## PITFALL-005: `functions/.env` 내 예약 접두어 포함으로 인한 Firebase Functions 배포 거부
- **증상**: `firebase deploy --only functions` 실행 시 환경 변수 접두어 검증 오류로 업로드/배포 실패.
- **근본 원인**: Firebase Cloud Functions 런타임은 `FIREBASE_`, `GCLOUD_`, `K_`, `PORT` 등 예약 접두어가 `.env`에 들어가는 것을 금지함.
- **절대 금지**: `functions/.env` 또는 `scripts/prepare-firebase-deploy.mjs`의 동기화 목록에 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` 등 `FIREBASE_*` 키 추가 금지.
- **올바른 패턴**: Cloud Functions 런타임에서는 `src/lib/firebase.ts`가 `FUNCTION_TARGET || K_SERVICE || FIREBASE_CONFIG`를 감지해 Application Default Credentials(`initializeApp()`)로 자동 초기화.
- **회귀 테스트 ID**: `verify-fix-safety.mjs`

---

## PITFALL-006: `firebase-admin` v14의 `initializeFirestore` 타입 충돌 (`TS2353`)
- **증상**: `initializeFirestore(app, { ignoreUndefinedProperties: true })` 작성 시 TypeScript 컴파일 에러 `Object literal may only specify known properties, and 'ignoreUndefinedProperties' does not exist in type 'FirestoreSettings'`.
- **근본 원인**: `firebase-admin/firestore` v14의 `FirestoreSettings`는 `preferRest`만 선언하고 있으며, `ignoreUndefinedProperties`는 `Firestore` 인스턴스의 `.settings()` 메서드에 존재함.
- **절대 금지**: `initializeFirestore` 두 번째 인자에 `ignoreUndefinedProperties` 전달 금지.
- **올바른 패턴**: 앱 최초 초기화 시 `const firestore = getFirestore(app); firestore.settings({ ignoreUndefinedProperties: true });` 호출 (`src/lib/firebase.ts` 참조).

---

## PITFALL-007: Stripe 공개키(`pk_live_`) 차단 및 클라이언트 결제 금액 신뢰 위험
- **증상**: 실운영 Stripe 키(`pk_live_...`) 입력 시 결제창이 열리지 않거나, 클라이언트 변조로 $1 결제 후 $500 카드 발급 시도 가능성.
- **근본 원인**: 과거 `pk_test_` 접두어만 허용하던 하드코딩 및 서버 측 금액 재계산/중복 검증 누락 시 보안 취약.
- **절대 금지**: `pk_live_` 차단, 클라이언트 `paidAmount` 그대로 신뢰, `verifySucceededPaymentIntent` 또는 `processedPaymentIntents` 중복 락 우회 금지.
- **올바른 패턴**: `GiftCardForm.tsx`는 `pk_test_`와 `pk_live_` 모두 허용(`sample`/`placeholder`만 차단). 서버는 `calculatePromotionDiscount` 재계산 + Stripe API 직접 조회 + `processedPaymentIntents` 트랜잭션 락 강제.
- **회귀 테스트 ID**: `QA-01`, `QA-07`, `QA-18`, `verify-fix-safety.mjs`

---

## PITFALL-008: 공개 조회 API에서 개인정보(PII) 노출
- **증상**: `/api/gift-cards/check?code=...` 응답에 구매자/수신자 이메일, 전화번호, 실명 전체, 메시지, Stripe PaymentIntent ID가 그대로 포함됨.
- **근본 원인**: DB에서 읽은 `GiftCard` 객체를 필터링 없이 그대로 `JSON` 반환함.
- **절대 금지**: 공개 조회 엔드포인트에서 `buyerEmail`, `recipientEmail`, `buyerPhone`, `recipientPhone`, `stripePaymentIntentId`, `message`, `buyerName`, `recipientName` 반환 금지.
- **올바른 패턴**: `maskName()`을 적용한 `recipientMaskedName`, `senderMaskedName` 및 바우처 렌더링에 필요한 비민감 필드(`code`, `currentBalance`, `barcodeDataUrl`, `qrCodeDataUrl` 등)만 화이트리스트 매핑하여 반환.
- **회귀 테스트 ID**: `QA-16`

---

## PITFALL-009: 센트 미만 소수점(`0.004`) 차감 및 비유한수 입력 방어 누락
- **증상**: POS 차감 API 또는 `redeemGiftCardAsync`에 `0.004`를 전달하면 `amount > 0` 조건만 통과한 뒤 센트 반올림(`Math.round((200 - 0.004) * 100) / 100`)으로 잔액이 변하지 않으면서 `$0.00` 유령 차감 성공 트랜잭션이 기록됨.
- **근본 원인**: `amount > 0`만 검사하고 `Number.isFinite` 및 센트 정밀도(소수점 둘째 자리, 최소 `$0.01`) 검증을 하지 않음.
- **절대 금지**: 금액 검증에 `amount > 0` 단순 부등호만 사용 금지.
- **올바른 패턴**: `src/lib/barcode.ts`의 `isValidDollarCents(amount, min, max)`를 사용하여 `redeemGiftCardAsync`, `redeemInFirebase`, `/api/create-payment-intent`, `/api/gift-cards/issue`, `/api/gift-cards/redeem` 및 `functions/src/index.ts` 양쪽 모두 동일 검증 적용.
- **회귀 테스트 ID**: `QA-19`, `QA-22`

---

## PITFALL-010: 프로모션 종료 시 프론트엔드 할인율 하드코딩으로 인한 결제 금액 불일치
- **증상**: `src/app/page.tsx`에 `const discountRate = 20`이 하드코딩되어 있어 11월 30일 프로모션 만료 후에도 화면에는 `$160` 할인가가 표시되지만 서버는 정가 `$200`으로 PaymentIntent를 생성함.
- **근본 원인**: UI가 서버의 `/api/promotions` 활성 여부를 조회하지 않고 정적 상수로 할인 UI와 예상 결제액을 계산함.
- **절대 금지**: 프론트엔드에서 프로모션 할인율을 고정 상수로만 유지하거나 `intentData.chargeAmount`를 무시 금지.
- **올바른 패턴**: `page.tsx`가 마운트 시 `/api/promotions`를 조회해 `isPromoActive`와 `discountRate`를 동기화하고, `GiftCardHero.tsx`/`GiftCardForm.tsx`는 `discountRate > 0`일 때만 할인 배지/행을 표시하며 Stripe 확인 버튼은 `intentData.chargeAmount`를 사용.
- **회귀 테스트 ID**: `QA-20`

---

## PITFALL-011: React 19 `react-hooks/set-state-in-effect`와 Next.js 16 프리렌더 동시 충족 패턴
- **증상**: Next.js 16 프리렌더 오류(`PITFALL-001`)를 피하기 위해 `useEffect(() => { setState(...) }, [])`를 사용하면 React 19 ESLint 규칙 `react-hooks/set-state-in-effect` 에러가 발생함.
- **근본 원인**: `useEffect` 본문 안에서 동기적으로 `setState`를 호출하면 불필요한 연쇄 렌더링이 유발됨.
- **절대 금지**: `useEffect` 본문에서 동기 `setState(...)` 직접 호출 금지.
- **올바른 패턴**: 브라우저 전용 값(`new Date()`, `window.location.search`)은 `useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)`로 파생하고, 네트워크 요청(`fetch`) 결과는 비동기 `.then()` 콜백 안에서만 상태 반영 (`page.tsx`, `GiftCardHero.tsx`, `GiftCardForm.tsx` 참조).
- **회귀 테스트 ID**: `QA-18`, `QA-23`

---

## 신규 버그 사후 기록 템플릿 (Postmortem Template)
새로운 버그를 해결할 때마다 아래 형식으로 이 파일에 추가하고 대응하는 회귀 테스트를 `run-qa-suite.mjs`에 등록하세요:

```markdown
## PITFALL-XXX: <짧은 제목>
- **증상**: <관측된 오류 또는 잘못된 동작>
- **근본 원인**: <정확한 코드/설정 원인>
- **절대 금지**: <다시는 하지 말아야 할 패턴>
- **올바른 패턴**: <검증된 해결 패턴>
- **회귀 테스트 ID**: <QA-XX>
```
