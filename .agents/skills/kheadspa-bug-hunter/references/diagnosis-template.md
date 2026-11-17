# Bug Diagnosis Report

- **Target / Failure ID**: `<예: QA-08 또는 사용자 보고 이슈>`
- **Related Known Pitfall**: `<예: PITFALL-002 / None>`
- **Analyzed At**: `<ISO Timestamp>`

## 1. Observed Symptom
<실패 로그, HTTP 상태 코드, 스택 트레이스 또는 UI 현상 요약>

## 2. Reproduction Condition
<어떤 입력값·환경 조건에서 항상 재현되는지>

## 3. Root Cause (Evidence-Backed)
- **File & Line**: `<파일 경로:라인>`
- **Cause**: <증상이 아닌 근본 원인 설명>

## 4. Impact & Dual-Backend / Dual-Storage Audit
- **Callers Affected**: <`pnpm qa:impact` 결과 요약>
- **Dual-Backend Sync Required?**: `<Yes (src/app/api/** + functions/src/index.ts) / No>`
- **Dual-Storage Sync Required?**: `<Yes (src/lib/storage.ts + src/lib/firebase.ts) / No>`

## 5. Surgical Fix Plan
- **Allowed Files to Modify**:
  - `<path/to/file1>`
  - `<path/to/file2>`
- **Protected Invariants & Untouched Callers**:
  - <절대 건드리지 않을 정상 파일 및 유지할 보안 규칙>
- **Required Regression Test**:
  - <`run-qa-suite.mjs`에 추가할 테스트 ID 및 검증 내용>
