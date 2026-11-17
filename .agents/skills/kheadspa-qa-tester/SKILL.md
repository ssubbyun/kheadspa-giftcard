---
name: kheadspa-qa-tester
description: >-
  Use this skill when designing test scenarios, running the automated QA test suite,
  or verifying UI/API/security behavior for the K-headspa & wellness gift card web app.
---

# K-HeadSpa QA Tester Skill

이 스킬은 테스트 설계와 검증 역할만 전담합니다. 코드를 직접 수정하지 않고, 정상 경로·경계값·보안·이중 백엔드 정합성·프론트엔드 동작을 검증한 뒤 객관적인 QA 리포트를 생성합니다.

## Reference Materials
- 테스트 매트릭스 및 신규 기능 시나리오 체크리스트: [test-matrix.md](./references/test-matrix.md)
- 과거 실수 원장(필독): [known-pitfalls.md](../../memory/known-pitfalls.md)
- 시스템 불변식: [system-invariants.json](../../memory/system-invariants.json)

## Execution Workflow

### 1. 자동 QA 스위트 실행 (`pnpm qa`)
격리된 임시 작업 폴더(`os.tmpdir()`)에서 실제 소스 코드를 번들링·실행하므로 프로젝트 `data/`를 오염시키지 않습니다.

```bash
pnpm qa
```

실행 결과는 아래 두 리포트 파일로 저장됩니다:
- `.agents/reports/qa-report.json`
- `.agents/reports/qa-report.md`

### 2. 신규 기능 추가 시 테스트 시나리오 설계 규칙
새로운 기능이나 API가 추가될 때는 반드시 [test-matrix.md](./references/test-matrix.md) 기준에 따라 아래 4개 축의 테스트 케이스를 `scripts/run-qa-suite.mjs`에 추가하세요:
1. **정상 경로 (Happy Path)**: 핵심 유즈케이스와 반환 스키마 검증
2. **경계값·비정상 입력 (Boundary / Negative)**: 음수, 0원, 최대/최소 금액 초과, 만료일 경과, 잔액 초과
3. **보안·프라이버시 (Security / PII)**: 직원 PIN 인증(`401`), Stripe 결제 검증, 공개 조회 API 내 PII 마스킹
4. **이중 백엔드 & 프리렌더 무결성**: Next.js `src/app/api/**` ↔ Firebase `functions/src/index.ts` 동기화 및 `no-store` 캐시 헤더

### 3. 브라우저 / UI 인터랙션 검증 (필요 시)
UI 레이아웃·콘솔 에러·사용자 플로우 확인이 필요하면:
1. 로컬 개발 서버(`pnpm dev`) 또는 배포 URL(`https://kheadspa-giftcard.web.app`)을 대상으로 `browser` 서브에이전트 또는 `chrome-devtools`를 사용합니다.
2. 확인 항목:
   - 메인 구매 페이지(`/`): 기본 언어 `EN`, 8종 카드 디자인 선택 시 프리뷰 실시간 전환, `Gift card sales are final` 문구, 콘솔 에러 0건
   - 모바일 바우처(`/?card=KSPA-...`): 1D 바코드, QR 코드, `Book a service` 링크(`https://kheadspawellness.glossgenius.com`)
   - 직원 POS(`/?mode=staff`): 카메라 스캔 모달 열기/닫기, 재발송 패널 표시

### 4. 실패 발생 시 인계 규칙
- `pnpm qa`에서 **단 1건이라도 실패(FAIL)**하면 절대 임의로 코드를 고치지 마세요.
- 실패 리포트(`.agents/reports/qa-report.md`)를 근거로 **`kheadspa-bug-hunter`** 스킬을 호출해 근본 원인을 특정하세요.
