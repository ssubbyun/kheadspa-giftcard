---
name: kheadspa-bug-hunter
description: >-
  Use this read-only diagnostic skill when a test fails, an unexpected error occurs,
  or before making any bug fix to trace root causes, caller impact, and past pitfalls.
---

# K-HeadSpa Bug Hunter Skill (Read-Only)

이 스킬은 **코드를 절대 수정하지 않는 읽기 전용(Read-Only) 진단 전담 스킬**입니다.
실패 로그를 보자마자 추측으로 패치하는 행위(증상 땜질)를 원천 차단하고, 근본 원인과 수정 허용 범위(`Allowed Files`)를 확정합니다.

## Iron Law
> **근본 원인 진단서(`.agents/reports/bug-diagnosis.md`)를 완성하기 전에는 단 한 줄의 소스 코드도 수정하지 않습니다.**

## 4-Step Root Cause Investigation

### Step 1. 과거 실수 원장 및 실패 리포트 확인
1. [known-pitfalls.md](../../memory/known-pitfalls.md)를 먼저 읽어 이미 겪었던 유형의 함정(`PITFALL-001` ~ `PITFALL-008`)인지 대조합니다.
2. `.agents/reports/qa-report.md` (또는 사용자가 보고한 에러 스택/로그)를 읽어 실패한 정확한 시나리오 ID와 에러 메시지를 확인합니다.

### Step 2. 영향도 및 호출처 분석 (`pnpm qa:impact`)
의심되는 파일이나 심볼을 대상으로 영향도 분석 스크립트를 실행합니다:
```bash
pnpm qa:impact <file_path_or_symbol>
```
스크립트는 아래 항목을 자동으로 찾아 출력합니다:
- `src/` 및 `functions/` 전체에서의 모든 호출처(Callers)와 import 경로
- **이중 백엔드(`src/app/api/**` ↔ `functions/src/index.ts`)** 또는 **이중 스토리지(`src/lib/storage.ts` ↔ `src/lib/firebase.ts`)** 동기화 필요 여부
- 관련 과거 함정(`PITFALL-XXX`) 목록

### Step 3. 데이터 흐름 역추적 & 단일 근본 원인 확정
- 입력 지점(`UI` 또는 `HTTP Request`) → 유효성 검사 → 비즈니스 로직(`storage.ts` / `barcode.ts` / `notifications.ts` / `stripe.ts`) → 영속 계층(`firebase.ts` / JSON)까지 실제 코드를 읽고 재현 조건을 100% 확정합니다.
- 증상(예: UI 에러 메시지)이 아니라, **그 증상을 유발한 최초의 잘못된 가정이나 누락**을 근본 원인으로 특정합니다.

### Step 4. 진단서 작성 (`.agents/reports/bug-diagnosis.md`)
[diagnosis-template.md](./references/diagnosis-template.md) 형식에 따라 `.agents/reports/bug-diagnosis.md`를 작성하고, 반드시 아래 두 섹션을 명시한 뒤 **`kheadspa-code-fixer`** 스킬로 인계합니다:
- **`Allowed Files to Modify`**: 수정이 반드시 필요한 최소 파일 목록
- **`Protected Invariants & Untouched Callers`**: 절대 건드리지 말아야 할 정상 모듈·보안 불변식 목록
