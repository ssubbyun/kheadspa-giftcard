---
name: kheadspa-stitch-ui
description: Use Google Stitch MCP (native Antigravity MCP or local scripts/stitch-mcp.mjs CLI) to design, generate, download, and safely port UI layouts into the K-HeadSpa Next.js 16 + React 19 gift card web application without violating prerender, lint, security, or dual-backend invariants.
---

# K-HeadSpa Stitch UI Design & Safe Porting Guide

## 1. Stitch MCP Connections & Credentials

This workspace connects to Google Stitch MCP (`https://stitch.googleapis.com/mcp`) through two synchronized channels:

1. **Antigravity Native MCP (`stitch` server)**:
   - Schema files live in `~/.gemini/antigravity/mcp/stitch/*.json`.
   - Before calling any Stitch tool via `call_mcp_tool`, read its schema file (e.g., `list_projects.json`, `create_project.json`, `generate_screen_from_text.json`, `list_screens.json`, `get_screen.json`, `download_file.json`).
2. **Project-Local MCP Config & Node CLI**:
   - Local MCP descriptor: `.mcp.json` (gitignored).
   - API key file: `secrets/stitch.env` (`STITCH_API_KEY=...`, gitignored; template at `secrets/stitch.env.example`).
   - CLI scripts:
     - `pnpm stitch:projects` — lists accessible Stitch projects (`node scripts/stitch-mcp.mjs list-projects`).
     - `node scripts/stitch-mcp.mjs get-project <projectId>` — inspects project metadata and `designTheme`.
     - `node scripts/stitch-mcp.mjs list-screens <projectId>` — lists screens and `htmlCode.name` entries in a project.
     - `pnpm stitch:generate -- --project <projectId> --prompt "..." [--device DESKTOP|MOBILE]` — generates a screen and writes JSON output to `scripts/stitch_gen_res.json` (gitignored).
     - `pnpm stitch:download` — downloads the generated HTML from `scripts/stitch_gen_res.json` (or `--entry projects/.../files/...`) into `.agents/reports/stitch_kheadspa_raw.html` (gitignored, never written into `public/` or `.firebase-public/`).

> [!CAUTION]
> **Secret Hygiene**: Never print, log, or commit `STITCH_API_KEY`, `secrets/stitch.env`, or `.mcp.json`. Never commit raw Stitch response artifacts under `public/` unless intentionally promoted to static site assets.

---

## 2. Mandatory K-HeadSpa Guardrails When Porting Stitch HTML to React

Raw HTML exported from Stitch uses Tailwind CDN classes and static markup. When translating Stitch designs into `src/app/**` or `src/components/**`, strictly follow `.agents/memory/known-pitfalls.md` and `.agents/memory/system-invariants.json`:

1. **Next.js 16 `cacheComponents: true` & React 19 Compliance (`PITFALL-001`, `PITFALL-011`)**:
   - Never call `new Date()`, `Date.now()`, or `window.*` synchronously during component render or `useMemo`.
   - Never call `setState(...)` synchronously inside `useEffect(() => { ... }, [])` (triggers `react-hooks/set-state-in-effect` in `pnpm lint`).
   - Use `useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)` for browser/time-dependent values, and apply async state updates only inside `fetch().then(...)` or event handlers.
2. **Preserve Stripe & Payment Invariants (`PITFALL-007`, `PITFALL-009`, `PITFALL-010`)**:
   - Keep `pk_test_` and `pk_live_` key support intact in `src/components/GiftCardForm.tsx`.
   - Keep `/api/promotions` dynamic fetch and `intentData.chargeAmount` binding intact so promo expiry never causes UI/server price mismatch.
   - Keep cent-level integer/two-decimal validation (`isValidDollarCents`) via `src/lib/barcode.ts`.
3. **Preserve Voucher, Barcode, & Bilingual UI**:
   - Keep `CODE128B` SVG/PNG barcode, QR code (`/?card=KSPA-...`), `EN`/`KO` toggle, 8 card themes, `Book a service` CTA (`NEXT_PUBLIC_BOOKING_URL`), and Staff POS barcode scanner working across UI redesigns.
4. **Full Verification After Any UI Port**:
   - Run all four gates before finishing any UI change:
     - `pnpm lint`
     - `pnpm qa`
     - `pnpm qa:verify-fix --allowed "<modified-files>"`
     - `pnpm build:firebase`
