---
name: kheadspa-code-fixer
description: >-
  Use this skill only after root-cause diagnosis to apply minimal surgical fixes,
  enforce allowed-file scope, sync dual backends, and pass full-system regression gates.
---

# K-HeadSpa Safe Code Fixer Skill

이 스킬은 **부분만 고치다 정상 동작하던 전체 시스템이나 다른 기능을 망가뜨리는 사고를 차단하는 3중 안전 잠금 수정 절차**를 강제합니다.

## 3-Lock Safety Protocol

### Lock 1. 진단서 & 과거 실수 원장 확인 (수정 전 필수)
- `.agents/reports/bug-diagnosis.md`와 [known-pitfalls.md](../../memory/known-pitfalls.md)를 먼저 읽고 수정 범위를 확인합니다.
- 진단서 없이 감으로 바로 코드를 수정하지 않습니다.

### Lock 2. 최소 범위 외과적 패치 (Surgical Scope)
- **허용 파일 외 수정 금지**: 진단서의 `Allowed Files to Modify` 목록에 포함된 파일만 수정합니다.
- **정상 코드 보존**: 주변의 정상 작동 코드, 포맷팅, 무관한 함수 시그니처를 리팩터링하지 않습니다.
- **이중 백엔드 동기화**: `src/app/api/**`를 수정할 때는 반드시 `functions/src/index.ts`도 함께 동기화합니다.

### Lock 3. 전체 시스템 게이트 & 2-Strike 서킷 브레이커
수정 완료 후 아래 4단계를 순서대로 모두 통과해야만 완료로 선언합니다:

1. **회귀 테스트 등록**: 같은 버그가 다시는 발생하지 않도록 `.agents/skills/kheadspa-qa-tester/scripts/run-qa-suite.mjs`에 회귀 테스트 케이스를 추가합니다.
2. **전체 QA 스위트 실행**:
   ```bash
   pnpm qa
   ```
3. **수정 안전성 & 범위 이탈 검증**:
   ```bash
   pnpm qa:verify-fix --allowed <file1,file2,...>
   ```
4. **전체 프로덕션 빌드 검증 (프론트 프리렌더 + Cloud Functions 번들)**:
   ```bash
   pnpm build:firebase
   ```

#### 2-Strike Circuit Breaker
- 검증(`pnpm qa`, `pnpm qa:verify-fix`, `pnpm build:firebase`)이 **2회 연속 실패**하면 덧대기 패치를 즉시 중단하고 변경 사항을 원복한 뒤, **`kheadspa-bug-hunter`** 단계로 돌아가 근본 원인을 재진단합니다.

#### 사후 학습 기록 (Postmortem)
- 새로운 유형의 버그를 수정했다면 `.agents/memory/known-pitfalls.md` 하단 템플릿에 따라 `PITFALL-XXX` 항목을 추가해 같은 실수가 반복되지 않도록 영구 기록합니다.
