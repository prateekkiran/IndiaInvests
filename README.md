# India Investment Journey

An India-first, fully client-side investment planning platform built from the PRD.
**See what you own, understand what the evidence supports, and explore how today's
decisions could affect future goals.**

- 100% in the browser — no backend, no external API, no provider logins, nothing uploaded.
- Encrypted on-device vault (Web Crypto AES-GCM + PBKDF2), encrypted backup/restore.
- Installable PWA (works offline after first load).
- Deterministic, unit-tested calculation engine (PRD formulas F01–F13 + every golden fixture).
- Free to host on Netlify (static site).

## Run it

```bash
cd "/Users/prateekkiran/Downloads/Amazon Quick/IndiaInvests"
npm install
npm test          # optional — proves the engine against the PRD's golden fixtures
npm run dev       # local dev at http://localhost:5173
```

## Build + deploy to Netlify (free)

```bash
npm run build                              # outputs ./dist
netlify deploy --prod --dir=dist           # first run prompts login + "create new site"
```

(`netlify.toml` already sets the build command, publish dir, SPA redirect and a tight
Content-Security-Policy. If you prefer Git-based deploys, push this folder to a repo and
"Import from Git" in Netlify — it will pick up `netlify.toml` automatically.)

## What's built (P0)

| Area | Delivered |
| --- | --- |
| Calculators | SIP, lump sum, step-up SIP, goal amount, required SIP, inflation/real — typed inputs + sliders, formula explanation, result table, chart, nominal/real toggle, save scenario |
| Explore | Compare up to 3 saved scenarios on a common basis + "what changed" + a lower-return stress path |
| Portfolio | Generic CSV import (transactions/holdings/prices/manual) with preview & issues; best-effort CAMS/KFintech CAS PDF (password, strict unsupported fallback); manual assets & liabilities; holdings, transactions, performance (XIRR gated on coverage), allocation, value bridge; fictional sample data |
| Goals | Templates, today/future amount basis, inflation, allocation with a global ledger that blocks >100% double-counting, funding ratio, shortfall, linked contribution streams |
| Overview | Net worth with coverage labels, "latest recorded values" framing, data-health strip, allocation, goal cards |
| Data centre | Import history + rollback, encrypted backup/restore, CSV ledger export (formula-injection safe), print plan, delete-all |
| Storage | Encrypted or unencrypted local vault, passphrase change, lock, persistent-storage request |

## Engine correctness

`src/engine/finance.test.ts` encodes every golden fixture from PRD §7 (SIP, lump sum,
step-up, goal inflation, required SIP, XIRR, withdrawal shortfall) plus edge cases
(negative returns, leap years, zero-rate annuities, ambiguous/no-root XIRR, same-date
aggregation). Run `npm test`.

## Assumptions locked in (zero-cost, industry-best)

Resolving the PRD's open questions (A01–A08 and §18):

1. **Audience** — adult Indian resident retail investors; INR, Indian digit grouping, FY (1 Apr–31 Mar), dates like "11 Oct 2026".
2. **Architecture** — responsive PWA, local processing, IndexedDB-backed encrypted vault. No server, so no hosting cost beyond Netlify's free static tier.
3. **No API** — strictly no runtime third-party calls. Valuations come from your statements and prices you enter; nothing is fetched automatically.
4. **First asset class** — mutual funds (CAS + generic CSV); other assets supported manually with a value date & basis.
5. **Advice posture** — self-directed educational planning only. No "best fund" scores, no buy/sell recommendations, no suitability scoring. Projections are explicitly pre-tax and labelled "assumed", never "guaranteed".
6. **Trust** — no ads, no data sale, no affiliate fund ranking. Nothing leaves the device unless you export it yourself.
7. **Security** — passwords held transiently in memory, never logged/persisted; parsing is defensive; CSV exports neutralise formula injection; tight CSP; scanned/unrecognised PDFs are rejected rather than guessed.
8. **Starter values** — illustrative 11% assumed return / 6% inflation, fully editable, never inferred from any fund's past performance.

## Not in this release (per the PRD's P1/P2 and legal gates)

TWR/benchmarks, retirement drawdown & Monte Carlo, depository (CDSL/NSDL) & broker
adapters, dedicated EPF/NPS/PPF parsers, tax-aware results, optional encrypted sync, and
local OCR. These need samples, effective-dated rules and/or independent review before they
can be claimed. A production launch also requires the Indian legal review the PRD describes
(SEBI IA framework, DPDP Rules commencement, CERT-In applicability).
