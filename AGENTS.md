<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## K-HeadSpa QA, Debugging & Safe-Fix Guardrails

When testing, investigating bugs, or modifying code in this repository, you MUST follow this 3-stage discipline to prevent repeating past mistakes, breaking healthy features, or breaking whole-system builds with partial patches:

1. **Read Past Pitfalls First**: Before changing or debugging any code, read [`.agents/memory/known-pitfalls.md`](.agents/memory/known-pitfalls.md) and respect all constraints in [`.agents/memory/system-invariants.json`](.agents/memory/system-invariants.json).
2. **Test Designing & Verification (`kheadspa-qa-tester`)**: Run `pnpm qa` to execute the isolated E2E & invariant QA suite. When adding new features, add happy-path, boundary, and security regression scenarios to the QA suite.
3. **Read-Only Root Cause Diagnosis (`kheadspa-bug-hunter`)**: Never patch symptoms directly when a failure occurs. First run `pnpm qa:impact <file_or_symbol>` to trace all callers, dual-backend (`src/app/api/**` ↔ `functions/src/index.ts`), and dual-storage (`src/lib/storage.ts` ↔ `src/lib/firebase.ts`) dependencies, and produce `.agents/reports/bug-diagnosis.md` listing exact `Allowed Files to Modify`.
4. **Surgical Fix & Whole-System Gate (`kheadspa-code-fixer`)**: Only modify files listed in `Allowed Files to Modify` without touching unrelated working code. Before declaring a fix complete, ALL THREE gates must pass:
   - `pnpm qa` (including newly added regression test)
   - `pnpm qa:verify-fix --allowed <comma-separated-files>`
   - `pnpm build:firebase`
   If verification fails twice consecutively, revert the patch and re-run `kheadspa-bug-hunter`. Record any newly discovered bug pattern in `.agents/memory/known-pitfalls.md`.
