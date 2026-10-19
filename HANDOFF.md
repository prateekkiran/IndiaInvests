# HANDOFF — India Investment Journey

A complete orientation for any engineer, agent, or LLM picking up this project. Pair it
with **`AGENTS.md`** (the mandatory git-first operating protocol) and the PRD
(`India_Investment_Journey_PRD.md`). **The code is the source of truth; this document is a
map.** When this map and the code disagree, the code wins — update this doc.

> First action in any new session: follow `AGENTS.md` §1 (sync from `origin/main`,
> `npm install`, `npm test`). Do not trust a local copy until verified against git.

---

## 1. What this is

An India-first, **100% client-side** investment-planning web app built from the PRD. The
promise: *see what you own, understand what the evidence supports, and explore how today's
decisions could affect future goals.* No backend, no external data APIs, no logins —
everything runs and stores on the user's device.

- Repo: `https://github.com/prateekkiran/IndiaInvests` (`main`)
- Live: `https://prateekkiran.github.io/IndiaInvests/`
- Status: P0 shipped and live; several P1 features added (household planning, broker
  imports, NAV packages, time-weighted returns, insights, command palette, onboarding
  tour, demo mode) and a "Rich" animation pass (anime.js v4).

## 2. Tech stack

| Concern | Choice |
| --- | --- |
| Language / UI | TypeScript (strict) + React 18 |
| Build | Vite 5 (`base: "/IndiaInvests/"`), `tsc -b` type gate |
| Tests | Vitest (jsdom) — engine golden fixtures + import/returns/allocation/household suites |
| Routing | Hash-based (no server rewrites needed on Pages) |
| Storage | IndexedDB; encrypted vault via Web Crypto (AES-GCM + PBKDF2) |
| Imports | papaparse (CSV); pdfjs-dist (CAS PDF, best-effort, strict fallback) |
| Animation | anime.js v4, wrapped by `src/anim/motion.ts` (reduced-motion aware) |
| PWA / offline | vite-plugin-pwa (Workbox) |
| Hosting | GitHub Pages via GitHub Actions — free, credit-free |

No runtime third-party calls. Everything above the storage layer is pure/deterministic
where it can be.

## 3. How to run

```bash
npm install
npm test            # engine + import/returns golden fixtures
npm run dev         # http://localhost:5173
npm run build       # tsc -b && vite build -> ./dist   (CI quality gate)
```

Deploy: just `git push` to `main`. GitHub Actions (`.github/workflows/deploy.yml`) tests,
builds, and publishes to Pages. See `AGENTS.md` §5. Do not reintroduce Netlify.

## 4. Module map (`src/`)

Engine (pure, deterministic, unit-tested — the trust core):
- `engine/money.ts` — decimal-safe money, Indian digit grouping, INR/percent formatting, parsing.
- `engine/finance.ts` — PRD formulas F01–F12: monthly-rate conversion, SIP/lump-sum FV,
  step-up, goal inflation, required SIP, CAGR, period gain, funding ratio, and the
  month-by-month projection engine (step-up / pause / one-time / withdrawals).
- `engine/xirr.ts` — F13 XIRR via a bracketed, residual-checked solver; flags ambiguous /
  no-root / short-period histories instead of returning a misleading single rate.
- `engine/scenario.ts` — turns calculator inputs into chart series + result table + a
  plain-language formula explanation (shared by Calculators and Explore).
- `engine/allocation.ts`, `engine/household.ts`, `engine/insights.ts` — P1: allocation
  math, shared-household sequential cash-flow modelling, and derived insights.
- `*.test.ts` — golden fixtures from PRD §7 plus edge cases. Keep these green.

State & domain:
- `types.ts` — the whole domain model (owners, instruments, accounts, transactions,
  snapshots, prices, manual assets/liabilities, import batches, issues, goals,
  contribution streams, saved scenarios, preferences) + schema/engine versions.
- `store/state.ts` — pure reducer + actions + `emptyState()`.
- `store/AppContext.tsx` — React context; owns the vault lifecycle
  (none/locked/unlocked) and auto-persists (encrypted) on every change.
- `store/vault.ts` — Web Crypto encrypt/decrypt + passphrase re-wrap. (Note the
  `Uint8Array<ArrayBuffer>` typing in `unb64` — required for `BufferSource` under TS 5.6+.)
- `store/db.ts` — minimal IndexedDB wrapper + persistent-storage request + quota estimate.
- `store/portfolio.ts` — derived views: valuation (price precedence, never fabricates a
  value), summary/coverage, and performance **gated on captured cash flows** (holdings-only
  positions are excluded from XIRR — see PRD POR01/POR04).
- `store/goals.ts` — goal projection + the global allocation ledger that blocks >100%
  double-counting.
- `store/returns.ts` — P1: time-weighted return / benchmark groundwork (`returns.test.ts`).

Imports:
- `import/csv.ts` — four generic templates (transactions/holdings/prices/manual) with
  tolerant header mapping; unparseable rows become visible issues, never silent drops.
- `import/cas.ts` — CAMS/KFintech CAS PDF reader (pdfjs). Rejects scanned/unrecognised
  layouts rather than guessing; passwords used only in memory. Labelled beta — review
  before commit.
- `import/brokers.ts`, `import/navpackage.ts` — P1: broker CSV/XLSX adapters and governed
  offline NAV packages. `imports.test.ts` covers these.

UI:
- `anim/motion.ts` + `anim/components.tsx` — the animation layer. **All motion goes through
  here.** anime.js v4 API (named imports, `animate(target,{...})`, `ease:` not `easing:`,
  `on*` callbacks, ms durations). Components: `CountUp`, `Reveal`, `AnimatedBar`. Every
  helper honors `prefers-reduced-motion` and falls back to final state on error.
- `components/ui.tsx` — design-system primitives (Card, Button, Badge, Callout, fields,
  sliders, tabs, segmented, Sheet, EmptyState, Disclosure…).
- `components/Charts.tsx` — accessible self-drawing SVG charts (growth with actual→projected
  boundary; allocation bars) with screen-reader tables and a table toggle.
- `components/CommandPalette.tsx`, `ShortcutsHelp.tsx`, `InstallPrompt.tsx`, `Icon.tsx` —
  P1 niceties (⌘K palette, keyboard-shortcut help, PWA install prompt, icon set).
- `screens/*` — Overview, Calculators, Explore, Portfolio, Goals, Household (P1),
  DataCentre, Settings, VaultGate.
- `onboarding/Tour.tsx` — guided first-run tour. `demo/*` — one-click fictional dataset.
- `report/planReport.ts` — print-friendly plan summary / CSV ledger export (formula-injection safe).
- `App.tsx` — shell: sidebar/mobile nav, routing, vault gate. `main.tsx` — entry + SW register.

## 5. Conventions

- **INR + India:** two-decimal INR, Indian digit grouping, FY starts 1 Apr, dates like
  "11 Oct 2026". Use helpers in `money.ts`/`util.ts` — don't hand-format.
- **Numbers animate:** prefer `CountUp` for headline figures; bars use `AnimatedBar`.
- **Never fabricate:** unknown price → unknown value (not zero); insufficient data →
  "unavailable" with a reason. Keep actual vs projected visually distinct.
- **Strict TS:** `npm run build` is the gate. `.tsx` bracket-balance tools give false
  positives on JSX — rely on `tsc`, not spot-checks.
- **Motion is optional:** never depend on an animation callback to reveal content or commit
  state; the reduced-motion path must render the same information.

## 6. Current status & suggested next steps

Shipped (P0) and live: calculators, scenario compare, portfolio (CSV + CAS + manual,
holdings/transactions/performance/allocation/value-bridge), goals with allocation ledger,
overview, data centre (backup/restore/export/delete), encrypted vault, PWA, privacy page.
Added (P1, verify depth against code): household planning, broker imports, NAV packages,
time-weighted returns/benchmark groundwork, insights, command palette, onboarding tour,
demo mode, and the anime.js Rich UX pass.

Good next candidates (PRD P1/P2): retirement drawdown / SWP with sequence-of-returns and
depletion month; TWR vs. compatible total-return benchmark on aligned dates; dedicated
EPF/NPS/PPF effective-dated projections; depository (CDSL/NSDL) CAS adapters; optional
encrypted sync. Each needs its golden-fixture tests before it ships. A real launch also
needs the Indian legal review the PRD describes (SEBI IA, DPDP, CERT-In).

## 7. Gotchas

- Vite `base` must match the Pages path (`/IndiaInvests/`); a repo rename breaks asset URLs
  until updated. Hash routing is intentional — don't swap to history routing without SPA
  fallback handling.
- The CAS parser is best-effort by design; the reliable import paths are CSV + manual.
- Forgotten vault passphrase is unrecoverable by design — the encrypted backup is the only
  recovery path. Keep that messaging honest in the UI.
- Don't commit `node_modules/`, `dist/`, `.netlify/`, `.preview/` (git-ignored).
