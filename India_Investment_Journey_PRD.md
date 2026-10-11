# India Investment Journey Platform

## Product Requirements Document

Version 1.0 • 11 October 2026 • Proposed product specification

Audience: product, design, engineering, quality assurance, security, compliance and founding team. Product name, commercial model, staffing and launch dates remain undecided.

This document specifies an India-first platform that helps investors understand their existing investments, explore financial choices and build a goal-based financial journey. The recommended launch product combines statement-based mutual fund tracking with transparent calculators and scenario comparison. Its core operates without external APIs, provider credentials or live market connections.

The central product promise is: **see what you own, understand what the evidence supports, and explore how today's decisions could affect future goals.** Every historical result must trace to imported evidence; every projection must expose its assumptions. A polished chart is not a substitute for complete data.

### Document map

1. Product mandate and assumptions
2. Vision and positioning
3. Personas and jobs to be done
4. Scope and priorities
5. End to end journeys
6. Functional requirements
7. Financial calculation specifications
8. Indian statement and data source research
9. Import and reconciliation design
10. Data model and architecture
11. Experience and wireframe guidance
12. Security privacy and regulatory boundaries
13. Quality and acceptance criteria
14. Metrics and learning plan
15. Roadmap and operating model
16. Dependencies and risks
17. Sources and evidence limitations
18. Prioritized clarifying questions

## 1 Product mandate and assumptions

### Confirmed requirements

The brief requires an India-first, visually compelling investment planning platform; SIP and related calculators; investment returns visualization; portfolio ingestion from exported financial statements; no dependency on external APIs; and comprehensive requirements supported by research. The original conversation contains the initial brief only. No choices about storage, monetization, asset coverage, advice, language, technical stack or delivery schedule were confirmed.

### Proposed decisions requiring validation

| ID | Proposed assumption | Rationale and consequence |
| --- | --- | --- |
| A01 | Start with adult Indian resident retail investors | Reduces residency, tax and guardianship complexity; NRI and minor accounts need separate requirements |
| A02 | Launch as a responsive web app with local processing and an encrypted local vault | Makes offline calculations and private imports feasible; browser storage loss and recovery need explicit design |
| A03 | Treat no API as no external runtime dependency for core journeys | First-party code and optional infrastructure may exist; live data, cloud OCR, third-party login and AI services cannot be prerequisites |
| A04 | Mutual funds are the first fully supported asset class | Detailed CAS provides a practical starting point; other assets can be added manually before dedicated parsers |
| A05 | Provide self-directed educational planning initially | Personalized recommendations and product rankings remain gated by legal review |
| A06 | Use English, INR, Indian number grouping and Indian financial years at launch | Hindi and additional languages follow validated demand; dates use unambiguous display formats |
| A07 | No advertisements, sale of portfolio data or affiliate-led fund ranking | Proposed trust principle; subscription and purchase models remain commercial hypotheses |
| A08 | Offline files are the fallback for market and reference data | Online research is an editorial input, not a runtime dependency or a guarantee of redistribution rights |

In this PRD, **P0** means required for launch, **P1** means the next release after launch gates pass, and **P2** means expansion subject to validation. “Must” denotes a requirement within the stated release. Numeric product targets and time estimates are proposals, not observed results or commitments.

## 2 Vision and positioning

### Problem

Investors hold assets across portals, statements and spreadsheets. Calculators typically begin from an empty balance and hide timing conventions. Portfolio dashboards can show an attractive number without explaining whether cost basis, history or valuations are complete. Investors need to connect their actual starting position with future contributions, inflation, life events and competing goals.

### Product vision

Create a personal financial workspace that turns fragmented investment records into an understandable journey. The experience should support three recurring questions: What do I own and how reliable is this view? What has driven the change in value? What changes if I contribute more, pause investing, move a goal or face weaker returns?

The proposed differentiation is the combination of auditable imports, transparent scenario mechanics and calm visual planning. This is a positioning hypothesis, not a claim that existing products lack these capabilities. Discovery should compare user workflows against spreadsheets, provider dashboards and planning tools before finalizing messaging.

### Outcomes and principles

- Enable a useful first scenario without registration or a statement.
- Convert a supported statement into a reconciled portfolio without asking for provider login credentials.
- Separate contributions, withdrawals and investment performance.
- Distinguish historical observations, incomplete estimates and future assumptions in every view.
- Make uncertainty, inflation, liquidity and tradeoffs understandable without implying guaranteed outcomes.
- Preserve user control through export, reversible imports and understandable deletion.

The product will not execute orders, collect investment money, initiate SIP mandates, promise returns, file taxes or replace provider records. It will not label an estimate as a verified result merely because a file imported successfully.

## 3 Personas and jobs to be done

These are research hypotheses rather than validated market segments.

| Persona | Situation and job to be done | Main friction | Success signal |
| --- | --- | --- | --- |
| First time salaried investor | When I can save monthly, help me translate an amount into a realistic goal | Unfamiliar return and inflation assumptions | Can explain contributions versus growth and save a scenario |
| Established mutual fund investor | When holdings span portals, help me see one accurate picture | Repeated imports, missing folios and confusing returns | Reconciles holdings and understands missing history |
| Household planner | When goals compete, help me allocate savings without counting assets twice | Multiple owners, shared goals and liquidity constraints | Sees affordable allocations and ownership clearly |
| Pre retirement investor | When income will stop, help me test withdrawal timing and bad early returns | Average-return calculators hide depletion risk | Can compare retirement paths and recognize shortfall |
| Detail oriented investor | When a result looks wrong, show its inputs and let me correct the record | Opaque calculations and undocumented adjustments | Traces a result to source rows and reproduces it |

Priority JTBD: “When I upload my investment statements, show me a trustworthy starting position so I can plan my next contribution.” Secondary JTBD: “When circumstances change, compare options while keeping my original plan intact.” Household collaboration and advanced retirement planning follow the first two jobs.

Discovery should include 12–15 participants across these hypotheses, with consented, redacted sample files from multiple statement periods. Test comprehension as well as task completion. Include people who currently use spreadsheets and people who abandon financial calculators.

## 4 Scope and priorities

| Capability | P0 launch | P1 next | P2 expansion |
| --- | --- | --- | --- |
| Calculators | SIP, lump sum, step up SIP, goal amount, required contribution, inflation | SWP, retirement drawdown, generic FD/RD, loan comparison | Advanced tax-aware and probabilistic simulations |
| Portfolio | MF holdings, supported CAS transactions, manual assets and liabilities | Selected broker CSV/XLSX and depository CAS | Dedicated NPS, EPF and additional provider adapters |
| Returns | Value, contributions, absolute gain where justified, eligible XIRR | TWR, benchmarks and rolling return studies with adequate data | Advanced attribution and look-through analysis |
| Goals | Single and multiple goals, allocation, scenario comparison | Household ownership and life event planning | Advisor collaboration after regulatory design |
| Reference data | Versioned local catalogue, statement NAV, manual price file | Governed offline NAV/history packages | Licensed broader market datasets |
| Storage | Local encrypted vault and encrypted backup | Optional encrypted sync after recovery design | Multi-device and shared workspaces |
| Reporting | Printable plan summary, CSV ledger, encrypted backup | Custom reports and comparisons | Permissioned collaboration exports |

P0 manual assets include cash, FD/RD balances, EPF, PPF, NPS, gold, property and other investments. Manual liabilities include loans and other debts. Each requires a value date and valuation basis; manual inclusion does not enable instrument-specific tax, liquidity or performance calculations automatically. Insurance cover is recorded separately from investment assets; premiums are not treated as portfolio value.

Excluded from initial releases: derivatives analytics, crypto, intraday prices, bank aggregation, email inbox scanning, broker execution, automated scraping of authenticated portals, recommendations to buy or sell named products, tax filing and loan origination. Product-specific PPF, EPF, NPS and small-savings projections require effective-dated rules before they can be described as such; generic compound-interest tools must not borrow these labels.

## 5 End to end journeys

### Journey A Explore without importing

Entry → choose a goal or calculator → enter monthly contribution, horizon and assumed return → view contribution and growth chart → switch nominal and real values → compare a second scenario → save locally or export. A sample scenario is clearly labelled fictional. No email, PAN or account setup is required to reach the first result.

The user can change annual effective return and see the monthly conversion and contribution timing. Impossible targets produce an explained shortfall or required contribution, never a fabricated recommendation to take more risk.

### Journey B Build a portfolio from statements

Choose provider and statement type → read download instructions → obtain file independently → select file locally → enter PDF password if required → inspect detected owner and coverage → review extracted records and exceptions → confirm accounts and instruments → commit reconciled records → view portfolio with freshness and history badges.

A summary statement produces holdings and valuation only. The result explains which calculations require a detailed statement. Wrong passwords, scans, unsupported layouts and oversized files get specific recovery options. Cancel discards staging data. A user may commit unaffected accounts while blocked accounts remain excluded and visibly listed.

### Journey C Update an existing portfolio

Import overlapping or newer statement → see new rows, duplicates, corrections and missing accounts → review conflicts → commit a versioned update → see a bridge from previous to new value. Importing the same file twice changes nothing. Absence of a folio in an incomplete file does not mean the folio was sold.

### Journey D Turn holdings into a plan

Choose a goal in today's rupees → select target date and inflation → allocate existing assets subject to liquidity restrictions → add planned contributions → compare base, lower-return and higher-return assumptions → test a pause or one-time expense → save the preferred scenario and its assumptions.

The system prevents allocation of more than 100% of any asset across goals. It warns when aggregate planned contributions exceed the user's entered savings budget. Goal allocation is a planning label, not a transfer or trade.

### Journey E Review and recover

Open the saved plan → see stale sources and changes since last review → refresh statements or retain the historical snapshot → update assumptions → export a dated plan and backup. Restore into a fresh local vault validates integrity and schema before replacing or merging data. Recovery must not depend on the original browser installation.

## 6 Functional requirements

### Onboarding and workspace

**ONB01 — P0.** Offer “Try a calculator”, “Use sample data” and “Import my portfolio”. Explain local storage, backup responsibility and the absence of automatic market updates before saving personal data.

**ONB02 — P0.** Store currency, date preferences and fiscal-year setting locally. Display dates as “11 Oct 2026”; accept ISO dates in templates. Indian FY 2026–27 runs from 1 Apr 2026 to 31 Mar 2027.

**ONB03 — P0.** Allow manual correction of profile labels. Do not require full PAN, Aadhaar or bank numbers for onboarding. Imported identifiers must be masked and minimized.

### Calculators and scenarios

**CAL01 — P0.** Each calculator has typed input fields, optional sliders, units, validation, a formula explanation, a result table and a chart. Sliders never replace exact input. Changes update without submitting a form.

**CAL02 — P0.** Support beginning/end-of-month timing, pause months, one-time additions, annual percentage step ups, horizon changes and zero or negative return assumptions within the domain. Unsupported combinations are blocked with an explanation.

**CAL03 — P0.** Compare up to three scenarios with identical axes, dates and currency basis. Save immutable revisions; show changed inputs and differences in required contribution, projected value and shortfall. Reset returns to the saved baseline.

**CAL04 — P0.** Provide user-editable return and inflation assumptions. Any starter values are visibly illustrative and never inferred from a fund's recent performance. Show “Assumed annual return”, not “Expected guaranteed return”.

**CAL05 — P1.** Add withdrawal and retirement models, expense inflation, retirement ages, pension inflows and an explicit terminal reserve. Show depletion month and unmet withdrawals. Model lock-ins separately from valuation.

### Portfolio and performance

**POR01 — P0.** Show portfolio value, net contributions over the selected covered period, eligible returns, asset allocation, source coverage and unresolved exceptions. Never combine an incomplete portfolio gain with an unqualified total.

**POR02 — P0.** Filter by owner, account, asset class, fund house, scheme and goal. Keep direct/regular and growth/IDCW options separate. Drill down to ledger, statements, prices and calculation inputs.

**POR03 — P0.** Present actual-value history only where dated holdings and prices support it. Incomplete history uses observed points with gaps. Do not invent a smooth historical curve from the current balance.

**POR04 — P0.** Report “Performance unavailable” with a reason when history, opening valuation, cash flows or terminal valuation are insufficient. A user-entered opening value enables period performance only, not since-inception performance.

**POR05 — P1.** Compare time-weighted portfolio returns with a compatible total-return benchmark over aligned dates, or compare actual investor cash flows with a clearly described hypothetical benchmark investment. Never compare portfolio XIRR directly with an index CAGR without explaining the different measurement basis.

### Goals and planning

**GOAL01 — P0.** Store goal amount, amount basis, target date, priority, inflation, linked assets and contributions. Templates include emergency reserve, education, home purchase and retirement, with editable labels and no prescribed product.

**GOAL02 — P0.** Show future target, allocated present value, projected value, funding ratio and shortfall separately. Current allocation divided by future target is not projected goal readiness.

**GOAL03 — P0.** Maintain a global allocation ledger to prevent double counting. Support partial allocation and an unassigned asset pool. Planned contribution allocations cannot exceed the same contribution stream without an explicit budget warning.

**GOAL04 — P1.** Add life events, variable income, spending changes and liquidity dates. Model goal withdrawals once across the shared household simulation. A sequential cash-flow engine must replace independent goal sums when funds are shared.

### Imports reference data and exports

**IMP01 — P0.** Support a published allowlist of tested CAS PDF layouts and the product's generic CSV template. Accept encrypted text PDFs with user-supplied password. Unsupported PDFs must not silently fall through to approximate extraction.

**IMP02 — P0.** Preview every account, statement period, extracted total and blocking issue. Store parser version and field provenance. Allow batch rollback without removing independent later data.

**REF01 — P0.** Every product or price record includes source, effective date, retrieved date, import version and verification status. Search matches a local catalogue; lack of internet never prevents manual entry.

**REF02 — P0.** Product information includes asset category, identifiers, plan/option, factual liquidity conditions and source links where verified. No unexplained “best fund” scores. Rates, expenses and risk labels require effective dates; stale factual entries are flagged.

**EXP01 — P0.** Export selected ledger rows to CSV, a print-friendly plan with charts and assumptions, and a versioned encrypted backup. Exports include valuation dates, excluded accounts and missing-data warnings. A privacy preview lets users omit identifiers before sharing; the app does not send the report automatically.

**OPS01 — P0.** Provide a local diagnostic report excluding file contents, identifiers, passwords and balances by default. Support requests that include statements require explicit consent and a secure, time-limited process outside routine analytics.

## 7 Financial calculation specifications

### Common conventions

The engine uses decimal arithmetic for stored money, units and NAVs; iterative return solvers may use high precision numerical methods with checked residuals. Preserve source precision, calculate before display rounding, and render INR to two decimals by default. Use integer month indices for projections and date-only values for investment events. Annual effective rates are decimals internally: 12% becomes 0.12.

Default projections use constant monthly equivalent returns and end-of-month contributions, both visible and editable. This is a modelling convention, not a description of actual market paths or allotment dates. Dates and rules are versioned with each saved scenario.

### Core formulas

| ID | Formula and inputs | Required behavior |
| --- | --- | --- |
| F01 | Monthly rate i = (1 + R)^(1/12) − 1 | R is annual effective return and must exceed −100%; never silently substitute R/12 |
| F02 | Lump sum FV = PV × (1 + i)^n | n is nonnegative whole months; n = 0 returns PV |
| F03 | End-month SIP FV = P × ((1 + i)^n − 1) / i | At i = 0 use P × n; beginning-month SIP multiplies by (1 + i) |
| F04 | Step up P_t = P_1 × (1 + g)^floor((t − 1)/12) | Step occurs first at month 13; alternative schedules must be explicit |
| F05 | End-month balance B_t = B_(t−1) × (1 + i_t) + P_t − W_t | Separate timing for beginning-month events; stop withdrawals at available balance and report unmet amount |
| F06 | Future goal G_n = G_0 × (1 + f)^(n/12) | f is annual inflation; future-rupee goals are not inflated again |
| F07 | Real future value = FV / (1 + f)^(n/12) | Real annual return = (1 + R)/(1 + f) − 1; basis must be visible |
| F08 | Required end-month SIP = max(0, (G_n − PV × (1 + i)^n) / A) | A = ((1 + i)^n − 1)/i; use A = n at zero rate; n = 0 yields immediate gap rather than division |
| F09 | CAGR = (V_end / V_start)^(365/d) − 1 | Only for positive starting value, positive elapsed days and no intervening external flows; zero terminal value gives −100% |
| F10 | Value at date d = sum of units_j(d) × price_j(d) plus valued manual assets | All prices must be dated no later than d; unknown valuations remain unknown rather than zero |
| F11 | Period investment gain = V_end − V_start − external inflows + external outflows | Both endpoints and flow coverage must be adequate; cash retained inside portfolio is not an external outflow |
| F12 | Funding ratio = projected allocated value / future goal value | A zero goal is invalid; overfunding is displayed rather than silently capped |

For beginning-month cash flows, B_t = (B_(t−1) + P_t − W_t) × (1 + i_t), with withdrawal affordability checked before growth. A general event engine orders events explicitly; it must not mix timing conventions inside one formula. For step-up, irregular and pause scenarios, the event engine is authoritative and closed forms are cross-checks.

### XIRR and portfolio boundaries

**F13.** Solve sum(C_k / (1 + r)^((d_k − d_0)/365)) = 0 for r > −1. Investor contributions are negative and investor receipts are positive. Include a positive terminal portfolio value at its valuation date; aggregate same-date cash flows. Use an opening negative market value to measure a bounded period when pre-period purchase history is incomplete.

Require at least one positive and one negative flow, nonzero elapsed time and complete relevant coverage. Use bracketed numerical solving, not an unchecked Newton result. Proposed solver search range is −0.999999 to 100 annual rate units with a documented log-spaced scan, bounded iterations and a residual tolerance of max(INR 0.01, 10^−10 × total absolute flows). Flag roots at limits, nonconvergence and ambiguous roots. A scan does not prove uniqueness for non-conventional cash flows; multiple sign-change histories receive an ambiguity warning and must not produce an unqualified single return. Do not annualize very short periods without an adjacent period-duration warning; default to gain amount for periods under 30 days.

At scheme scope, a switch is a redemption and purchase. At combined portfolio scope, paired internal switches and transfers are not external investor flows. Reinvested IDCW is internal at portfolio scope; cash IDCW paid outside is a positive receipt. Fees and taxes paid outside the tracked portfolio can be included in an explicitly labelled investor-net calculation when captured. Missing broker cash ledgers may make whole-account XIRR unavailable even when security-level returns can be calculated.

### Time weighted returns and risk

**F14 — P1.** Split valuation history at external flows. For a subperiod bounded immediately after the preceding flow and immediately before the next flow, r_j = V_end_before_flow / V_start_after_flow − 1. Chain TWR = product(1 + r_j) − 1. Require reliable boundary valuations; beginning-day or end-day flow assumptions must be stated for daily approximations. Zero starting values or missing boundaries suppress the affected result.

**F15 — P1.** Drawdown = wealth_index_t / maximum_prior_wealth_index − 1. Use a flow-adjusted return index, not raw portfolio value. Volatility uses a defined sampling frequency and annualization factor; missing or irregular observations must not be treated as zero returns.

**F16 — P1.** Historical SIP simulations allocate units using available historical prices on the stated eligible date, with a documented next-available-price rule. They are hypothetical because actual allotment depends on transaction circumstances. Include distributions and corporate actions or label the series price-only. Never splice direct and regular plan histories or extend a fund before inception.

### Additional planning calculations

**F17 — P1.** Generic deposit FV = principal × (1 + nominal annual rate / m)^(m × years) only when the selected product explicitly uses that compounding convention. RD uses a deposit schedule and a rate convention; do not imply one generic formula matches every bank. Product-specific day counts, premature closure penalties and tax effects require separate rules.

**F18 — P1.** Loan EMI = L × j × (1 + j)^n / ((1 + j)^n − 1), with L/n at zero monthly rate. A loan-versus-invest comparison must align monthly budgets, loan amortization, prepayment timing and investment assumptions. It must not imply uncertain investment returns are equivalent to saved loan interest.

**F19 — P1.** Retirement uses monthly inflation-linked withdrawals, pension inflows, fees and end reserve within the event engine. A constant-return result is a deterministic illustration. Early-loss and later-loss scenarios demonstrate sequence risk. The system must not label a corpus “safe” solely because average returns cover average expenses.

**F20 — P2.** Monte Carlo results require a versioned return model, correlation assumptions, fees, inflation, seed and simulation count. Percentiles are model outcomes, not confidence guarantees. Ship only after independent quantitative review and user comprehension testing; scenario bands in P0 are not probability bands.

Tax-aware results are deferred. A later tax module needs effective-dated rules by asset category, acquisition and sale dates, holding period, residency, exemptions, loss treatment, surcharge/cess and policy transitions. Until verified, projections are explicitly pre-tax. Actual imported transaction charges are preserved; NAV-based returns must not subtract a fund's embedded expense ratio a second time.

### Golden calculation fixtures

| Fixture | Expected result |
| --- | --- |
| INR 1,000 end-month SIP for 12 months at 0% | INR 12,000 |
| INR 10,000 lump sum for 12 months at 12% annual effective | INR 11,200 |
| INR 1,000 SIP for 2 months at 1% monthly | End-month INR 2,010; beginning-month INR 2,030.10 |
| INR 1,000 monthly with 10% step up over 24 months at 0% | INR 25,200; month 13 contribution INR 1,100 |
| INR 1,00,000 goal in today's money after 1 year at 6% inflation | INR 1,06,000 |
| Required SIP for INR 1,20,000 in 12 months with no initial balance at 0% | INR 10,000 per month |
| XIRR −10,000 on 1 Jan 2025 and +11,000 on 1 Jan 2026 | 10% within numerical tolerance |
| Balance INR 100, withdrawal INR 150 and zero growth | Pay INR 100; unmet INR 50; closing balance zero |

Tests also cover negative returns, leap years, duplicate dates, rounding boundaries, no-root and multiple-root XIRR histories, inconsistent cash-flow signs and boundary-month step ups.

## 8 Indian statement and data source research

Research verified public documentation and download surfaces, not private investor files. A documented export is a candidate source; it is not proof that a parser works. Sample acquisition and format certification remain release dependencies.

### Statement source matrix

| Source | Evidence and expected input | Proposed support and limitation |
| --- | --- | --- |
| CAMS and KFintech consolidated MF statements | KFintech documents consolidated PDF mailback across CAMS and KFintech, summary/detailed choices and password protection [S01]; CAMS has a CAS request surface [S02] | P0 after layout certification; request detailed history and zero-balance folios where available; coverage depends on account matching and selected period |
| CAMS CAN statement | Summary or detailed statement for CAN-linked CAMS-serviced folios; provider warns demat data may be incomplete [S03] | Separate adapter or clearly unsupported; do not mistake it for universal CAS |
| MFCentral | Official service describes a combined MF portfolio across folios [S04] | Download guidance candidate; exact authenticated export layouts must be sampled before promising support |
| CDSL and NSDL depository CAS | SEBI describes consolidated securities and MF statements; CDSL documents demat plus SOA holdings and PAN/holding-pattern consolidation [S05, S06] | P1 PDF adapters; overlapping MF positions need custody-aware deduplication; statement transaction periods are not necessarily lifetime cost history |
| Zerodha Console | Official tradebook export supports CSV/XLSX; external trades include transfers and corporate-action-related events [S07] | P1 first broker candidate; ingest holdings and supporting ledger/charges exports as needed, not tradebook alone for account performance |
| Other brokers and AMC portals | Provider-specific holdings, trades, capital-gains reports and statements | Generic CSV in P0; provider support only after samples and export instructions are verified |
| EPFO | Official member booklet describes downloadable PDF passbook [S08] | Manual balances P0; dedicated parser later; pension-related columns are not automatically investable corpus |
| NPS CRA | Official statement guide describes contributions, units, NAV and transactions; current Protean site lists several statement variants [S09, S10] | Manual P0; later adapters must distinguish tier, scheme and statement version, including NAV framework changes |
| Banks and small savings providers | No universal export format established by this research | Manual balances and generic CSV; source-specific bank, FD, RD and PPF adapters require further validation |

CAS is not a statement of all financial wealth. Missing bank deposits, provident funds, property and other assets must be explained. Provider passwords and download steps can change; show an “instructions checked on” date rather than hard-code a universal password pattern. This platform never requests OTPs to impersonate the investor or bypasses CAPTCHA.

### NAV and market data without APIs

AMFI publishes NAV download and history surfaces [S11, S12]. NSE publishes downloadable report files, including bhavcopy formats [S13], and maintains data-use rules [S14]. The existence of a public file does not establish commercial reuse or redistribution permission.

Proposed source precedence for a selected valuation date: a user-selected verified override with recorded reason; then an exact-date approved official data file; then a dated statement price; then a manually entered price. Preserve all observations and show conflicts. Source precedence cannot turn an old price into a current price.

P0 works using statement valuations and manual CSV prices. P1 introduces reviewed data packages downloaded by an operator or user through ordinary official download facilities. Packages contain original-file hash, source URL, retrieval time, valuation dates, parser version, rights status and manifest signature. Historical download windows and available fields must be confirmed against the current production surface; do not rely on limits found on staging or legacy websites.

AMC factsheets, scheme information documents and official product disclosures can populate a curated local catalogue. Search engines help locate primary sources; snippets are never authoritative data. Editors record source and effective date, review plan/option identifiers and publish a signed package. If terms prohibit redistribution, offer user-side import or obtain a licence. No scraping or invisible website endpoint is required for core functionality.

For non-trading days use the last available price on or before the target date, labelled with its actual date. A proposed warning starts after five business days for daily-priced assets; statement-only portfolios also receive an age label immediately. Locked, illiquid and manually valued assets use category-specific thresholds. Never substitute the next day's price in a historical valuation.

## 9 Import and reconciliation design

### Processing pipeline

1. Validate file signature, size and allowed type. Proposed limits: 25 MB, 250 PDF pages or 100,000 tabular rows per file; tune after profiling.
2. Hash the file and detect an exact repeat. Identify provider, layout version, statement type and period.
3. Decrypt locally in memory if necessary. Clear password references promptly; never log or save the password.
4. Extract text or cells in an isolated worker. Disable active PDF content, macros, external spreadsheet links and formula execution. P0 rejects image-only statements with guided alternatives; local OCR is P2.
5. Parse to staging records with source page/row, raw text, normalized values and field-level confidence.
6. Validate accounts, instrument mapping, date ranges, totals and transaction semantics.
7. Match existing records; classify new, duplicate, probable duplicate, conflicting, corrected and unsupported rows.
8. Reconcile opening units, movements and closing holdings. Present errors and repair actions.
9. Commit an atomic import revision after review. Retain lineage and the ability to reverse the batch.

Stages are visible, cancellable and resumable where safe. A failed import cannot mutate the committed portfolio. Partial import is allowed only for complete account partitions with a clear excluded-accounts banner.

### Canonical records and identity

Account identity uses owner reference, provider/custody system, account or folio identifier and holding pattern. Instrument identity prefers a validated ISIN or other authoritative code plus plan/option; names are aliases, not unique keys. Folio identifiers remain strings with leading zeros intact. PAN-derived matching, if used locally, must employ keyed or encrypted identifiers; a plain unsalted PAN hash is not an adequate confidentiality measure.

A transaction stores event date, optional settlement date, event type, units, gross and net amount, charges, NAV, currency, source transaction ID, linked event IDs, reversal status and evidence location. Store unit direction separately from investor cash-flow direction to avoid ambiguous negative signs.

Use exact provider transaction IDs within their account scope when available. Otherwise construct a candidate fingerprint from owner/account, instrument, date, event type, units and amount. Identical same-day purchases can be legitimate: absent strong evidence, preserve multiplicity and request review. A file hash prevents exact repeated files; it does not solve cross-provider overlap.

### Holdings and reconciliation rules

For each account and instrument: closing units = opening units + purchases + reinvestments + transfers in + corporate-action adjustments − redemptions − transfers out, after reversals. Summary holdings are dated snapshots, not new purchases. Preserve differing snapshots; choose the latest eligible snapshot for a view rather than summing snapshots.

Proposed tolerances derive from displayed precision. For a value comparison, start with max(INR 1, 0.01% of statement value) and flag larger differences. For unit roll-forward, use the sum of possible rounding errors at the source precision; if that tolerance becomes material, request higher-precision evidence. Tolerance is a review rule, never permission to modify units. Store exact differences and publish the applicable policy per parser.

Reconcile value using the statement's own date and NAV before comparing with another source. Purchases may include charges or duties, so cash paid does not always equal units multiplied by NAV. Do not “repair” mismatches by overwriting authoritative units. Missing history can be represented by an opening snapshot with unknown acquisition basis, not a fabricated purchase.

### Special event handling

- Pair switches and transfers through explicit identifiers or high-confidence matching; unmatched legs remain exceptions. Preserve original purchase lots for transfers where evidence supports them.
- Link reversals and corrections to original events; mark originals superseded instead of deleting audit history.
- Handle IDCW payout and reinvestment distinctly. A reinvestment can require two linked accounting legs but must not double-count external contributions.
- Record splits, bonus units, mergers, segregated portfolios and scheme renames as events with effective dates. Do not infer corporate actions solely from price jumps.
- Keep direct/regular and growth/IDCW positions separate even when base scheme names match.
- Exclude pending, rejected or cancelled transactions from settled holdings; retain them as informational events when available.
- Preserve zero-balance and closed folios when needed for historical performance; current holdings alone cannot establish realized returns.

### Confidence and exception workflow

High-confidence extraction requires a recognized layout, validated identifiers and successful reconciliation. Medium confidence requires user confirmation. Low confidence blocks the affected account. Unknown transaction types never become purchases by default. Display the source snippet alongside editable fields, reason codes and a “keep unresolved” action.

Manual corrections record old value, new value, reason, time and source reference. A later import cannot silently overwrite a correction. Re-parsing with a newer adapter creates a proposed diff, not an invisible historical rewrite. Removing an import recomputes dependent derived views and warns about goals that used the affected balances.

Generic CSV templates cover holdings, transactions, prices and manual assets. The wizard maps columns, validates date formats and decimal separators and previews signs. Exported CSVs neutralize spreadsheet formula injection in text cells while preserving valid numeric values.

## 10 Data model and architecture

### Core entities

| Entity | Essential fields |
| --- | --- |
| Workspace and owner | Local ID, display label, preferences, optional encrypted identity reference |
| Account | Owner, provider, custody, masked number, holding pattern, currency |
| Instrument | Internal ID, identifiers, plan, option, asset class, alias history, effective dates |
| Import batch and source | File hash, period, source type, parser version, status, commit revision |
| Transaction | Account, instrument, event dates, unit delta, amounts, event links, provenance |
| Holding snapshot | Account, instrument, units, value, valuation date, source and confidence |
| Price observation | Instrument, date, price, currency, source, quality and override reason |
| Reconciliation issue | Rule, severity, affected records, discrepancy, resolution and audit trail |
| Goal and allocation | Target, date, inflation, owner, linked asset portions and contribution streams |
| Scenario revision | Base data revision, assumptions, events, engine version and result checksum |
| Policy and reference package | Version, effective period, sources, licence status and signature |

### Recommended no API topology

User files → local import worker → staging and reconciliation → encrypted local ledger → deterministic calculation engine → portfolio, goal and scenario views → report and encrypted backup.

Separately: official public files → human download and review → versioned reference package → local package import. The latter path can be absent indefinitely; existing data and calculators must still work with explicit freshness limits.

Proposed implementation: a typed frontend, browser workers for parsing/calculation, bundled PDF and spreadsheet libraries, an IndexedDB-backed encrypted vault, and a pure calculation library with schema-versioned inputs and outputs. All fonts, icons, parsers and help required for the core experience ship with the application. Libraries are dependencies; runtime calls to their vendors are not permitted.

Use a progressive web app for installable offline operation after first download. Installation and software updates may require connectivity; “offline” does not mean the first visit can occur without receiving the application. Online updates must be signed/versioned, avoid deleting a working cached version before activation, and preserve migrations and rollback. A native wrapper is a later option if browser storage/recovery limits prove unacceptable.

### Availability and storage

Local vault unlock must work without an identity provider. Encrypt data with a random data key wrapped using a passphrase-derived key through a reviewed, versioned scheme. Do not invent a cryptographic protocol. A recovery key or encrypted backup flow must be demonstrated before persistent use; an unrecoverable forgotten passphrase must be explained accurately.

Browser storage can be cleared or evicted. Request persistent storage where supported, detect quota failures, and prompt encrypted backups after material imports. Display the last backup date. Multi-tab writers use revision checks to avoid lost updates. Schema migrations create a verified backup and run atomically.

Optional first-party sync is P1 and cannot gate calculators or local imports. Before implementation, decide key ownership, recovery, conflicts, device revocation, account deletion and retained metadata. Do not claim end-to-end encryption if the service can decrypt user content. No paid entitlement check may make the documented offline core unexpectedly unusable; commercial restrictions need a separate product decision.

### Operational reference publishing

An editor acquires permitted files, a validator checks dates/identifiers/anomalies, and a reviewer approves a package. Reject malformed files and quarantine unexplained NAV jumps; corporate actions must be considered before treating a jump as a data error. Retain an internal rights register and prior package versions. Users can inspect package age and roll back a faulty release.

## 11 Experience and wireframe guidance

### Visual language

Use a calm, content-led interface with generous spacing, readable numerals, restrained indigo and teal accents, and warm neutral surfaces. Red communicates a specific issue rather than ordinary market volatility. Use high-contrast text, visible focus and icon-plus-text status indicators. Avoid confetti for returns, trading-style urgency and leaderboards that reward risk-taking.

Proposed navigation: Overview, Portfolio, Goals, Explore scenarios, Calculators and Data centre. Settings contains privacy, backups, source packages and preferences. The mobile layout uses a compact primary navigation with secondary destinations under More; core controls remain accessible without hover.

### Screen 1 Overview

Top row: workspace selector, portfolio date and “Import update”. Below: total valued assets, liabilities and net worth with separate coverage labels. Main canvas: observed wealth history with contributions distinguished from gain, followed by goal cards. A persistent data-health strip explains stale prices, unpriced assets and incomplete transaction coverage. Selecting an issue opens its repair screen.

Do not put an XIRR card in the leading position for a holdings-only portfolio. A mixed-date sum is labelled “Latest recorded values” with date range, not “Portfolio today”. Offer an aligned-date view when supporting data exists.

### Screen 2 Import review

Desktop: progress steps above a two-column view. Left: accounts, instrument rows and issue badges. Right: source page or row excerpt, extracted values and resolution controls. Bottom: committed impact preview, excluded accounts and confirm/cancel. Mobile: source and extracted fields stack, with a persistent issue count. Password fields are not replayed in diagnostics.

### Screen 3 Portfolio detail

Header: account/instrument, units, value and valuation basis. Tabs: Holdings, Transactions, Performance and Sources. Allocation is a labelled horizontal bar or donut with an accessible table. A value bridge explains opening value + contributions − withdrawals + gain = closing value when coverage is complete. Unpriced positions remain visible outside the valued subtotal.

### Screen 4 Goal builder and scenario comparison

Desktop: editable controls on the left, large chart centre, outcome summary on the right. Controls include amount basis, horizon, existing allocation, monthly contribution, annual step up, return and inflation. Chart separates contributed capital from growth and distinguishes actual from projected periods with line style and a labelled boundary. A real-value toggle updates chart, cards and table consistently.

Comparison aligns three scenarios in columns with a common chart scale. A “What changed” list highlights contribution, goal date and assumptions. Show a lower-return path before suggesting a contribution is sufficient. Any distribution band must disclose whether it represents selected scenarios or a statistical model.

### Screen 5 Data centre and backup

Show import history, coverage timeline, parser versions, local reference packages, backup date and unresolved issues. Offer export, restore, rollback and delete with concrete impact previews. Support a privacy mode that masks balances on screen; it does not change stored data.

### Accessibility and content requirements

Target WCAG 2.2 AA through keyboard navigation, semantic forms, meaningful focus order, text alternatives for charts and sufficient contrast. Provide tabular equivalents and plain-language chart summaries, respect reduced motion and avoid color-only distinctions. Validate at 200% text zoom and 320 CSS-pixel width. Screen readers must announce result changes without narrating every slider movement.

Every major screen needs empty, loading, offline, stale, partial, error and success designs. Standard copy examples: “Holdings imported. Returns need more history.” “Value uses NAV dated 8 Oct 2026.” “These paths use your assumptions and are not forecasts.” “Three accounts need review and are excluded from this total.”

## 12 Security privacy and regulatory boundaries

### Product controls

Treat statements as highly sensitive financial records. Minimize collection; keep parsing on device; exclude full PAN, account numbers, amounts and raw text from analytics and logs. Bundle critical scripts, use a restrictive content security policy, prevent cross-site scripting, verify dependency integrity and maintain a software bill of materials. Encryption at rest does not protect an unlocked vault from malicious script, browser extensions or a compromised device.

Passwords remain transient in memory; do not persist decrypted PDFs by default. Allow optional encrypted retention of originals with clear space and privacy consequences. Store minimized source references for auditability; retaining snippets can still expose personal information and needs the same protection as the ledger.

Threat tests cover malicious PDFs, decompression bombs, giant spreadsheets, spreadsheet formula injection, poisoned reference files, prototype pollution, path traversal in backup archives, unauthorized sync access and data leakage in crash reports. Parsing workers have no network permission. Apply size, page, row, memory and time limits before and during extraction.

### Regulatory research and launch gates

SEBI's investment-adviser framework includes advice about securities and financial planning; classification depends on actual functionality and business model. The official consolidated regulations reviewed are labelled amended through 25 November 2025, and a February 2026 master circular was also located [S15, S16]. **Educational wording or a disclaimer does not itself establish an exemption.** Before launch, Indian counsel must assess calculators, goal outputs, personalization, compensation, marketing and distribution links. Named-product recommendations, suitability scoring and automated rebalance instructions stay disabled until the required model is approved.

The notified DPDP Rules 2025 use phased commencement: rules 1, 2 and 17–21 on publication, rule 4 after one year, and rules 3, 5–16, 22 and 23 after eighteen months [S17]. As of this PRD's date, do not describe every provision as already effective. Counsel must map the Act's commencement notifications, corrections and applicable rules to the planned launch date and local/cloud data flows. Build for clear purpose notices, consent management, correction, grievance handling and justified retention. Minors and household data need a separate lawful-processing design.

CERT-In's 2022 directions cover specified incident reporting within six hours and 180-day ICT log retention in India for covered entities [S18, S19]. Determine applicability, nominate an incident contact and reconcile log obligations with minimization. SEBI cybersecurity requirements require a separate applicability assessment if the operator becomes a regulated entity. Do not infer a blanket India-only storage rule for all personal data from the log requirement.

### Retention deletion and incident response

Proposed local behavior: remove staging on cancel, discard passwords immediately after use, retain normalized records until user deletion, and make original-file retention optional. The product cannot delete source files or backups the user stored elsewhere; disclose that distinction.

For any server-side data, do not promise unconditional immediate erasure. Maintain a counsel-approved, purpose-specific retention matrix covering production, backups, security logs, support files and legal holds, including future-effective DPDP requirements. Proposed operational deletion target is seven days for eligible production content and thirty days for expiring backups, subject to the final legal matrix. Expose retained categories, reasons and expected expiry.

Security owner maintains severity classification, containment, investigation, notification and recovery playbooks. Run a breach tabletop before launch. Support access is least-privilege, time-limited and audited. No live user statement enters development fixtures without explicit consent and irreversible redaction or replacement with synthetic records.

## 13 Quality and acceptance criteria

### Functional release tests

| Test | Given and action | Passing result |
| --- | --- | --- |
| AC01 Offline core | App installed; all external network calls blocked; import known PDF and calculate goal | Import, review, commit, calculations and export succeed; no third-party runtime call occurs |
| AC02 Summary statement | Import a holdings-only CAS | Units/value available; since-inception XIRR withheld with a clear reason |
| AC03 Idempotency | Import identical file twice and overlapping files in reversed order | Same canonical holdings and unique events; ambiguous matches enter review |
| AC04 Custody overlap | Import same demat holding through CAS and broker source | One economic position after approved linkage; evidence from both sources preserved |
| AC05 Missing history | Statement begins after first purchase | Opening snapshot retained; unknown basis displayed; no fabricated acquisition |
| AC06 Reconciliation failure | Closing units disagree beyond policy tolerance | Affected account blocked; discrepancy and source rows visible |
| AC07 Timing | Run all golden fixtures and timing variants | Money matches to INR 0.01; solver residual and return tolerance pass |
| AC08 Goal allocation | Allocate 70% and then 40% of one holding | Second allocation blocked or corrected before save; no double counting |
| AC09 Stale data | Open dated price package after freshness threshold | Actual price date and stale warning appear in views and exports |
| AC10 Atomicity and rollback | Cancel/fail halfway through import, then reverse a committed batch | No partial mutation; independent later records preserved |
| AC11 Restore | Export encrypted backup and restore into fresh browser profile | Ledger, goals, assumptions and version metadata match checksums |
| AC12 Security | Inspect logs/network while importing protected statement | No password, document text, PAN, balance or unauthorized upload appears |
| AC13 Unsupported layout | Import unseen or scanned statement | Clear unsupported state and manual alternative; no plausible fabricated portfolio |
| AC14 Reproducibility | Reopen saved scenario after reference data update | Original revision reproduces; refresh creates a new revision |

### Proposed service and performance targets

- Interactive calculators: p95 under 200 ms after input settles for ordinary 60-year monthly scenarios on the baseline device.
- Supported 50-page text PDF: p95 under 15 seconds to review; 10,000-row CSV under 5 seconds, excluding password entry and human review.
- Responsive interaction during parsing; progress visible within 1 second and cancellation acknowledged within 2 seconds.
- Baseline test devices: a documented midrange Android device with 4 GB RAM and a laptop with 8 GB RAM; capture exact models/browser versions before benchmarking.
- Support the current and previous major versions of Chrome, Edge, Safari and Firefox at release; storage limitations need browser-specific messaging.
- No silent data loss in interruption, quota, migration and multi-tab conflict tests. Optional sync has proposed RPO of 24 hours and RTO of 8 hours; local-only recovery depends on the user's latest backup.

### Parser certification

Maintain a consented or synthetic golden corpus by provider, layout, statement type, period, encryption and edge cases. Proposed minimum: 30 representative files per declared layout family and at least 1,000 financial rows overall, expanded until major variants are represented. Keep a held-out evaluation set.

Launch requires at least 99.5% exact match of critical extracted fields on the supported held-out corpus before correction, 100% detection of seeded material reconciliation errors, and zero known silent material errors. Report numerator, denominator and coverage; a high score on one layout does not certify another. Supportability takes precedence over claiming universal imports.

Finance reviewers approve formulas and accounting boundaries; security reviewers approve threat controls; designers run keyboard and assistive-technology checks. All P0 requirements must map to a test or a documented review gate. Unresolved critical/high security defects and silent material financial errors block release.

## 14 Metrics and learning plan

North-star proposal: **monthly users completing a meaningful plan review**. A review means checking a data/assumption freshness summary, saving a goal scenario and comparing at least one alternative or recording a deliberate unchanged decision. Do not equate page views, portfolio value or trading activity with investor benefit.

| Metric | Definition | Proposed initial target |
| --- | --- | --- |
| Calculator activation | Eligible new users saving/exporting a scenario divided by calculator starters | At least 50% in moderated/beta cohort |
| Import activation | Users committing a reconciled portfolio divided by users starting a supported import | At least 80% in beta |
| Time to first useful view | Median time from file selection to reconciled portfolio or from calculator entry to saved scenario | Under 5 minutes, excluding provider download wait |
| Correction burden | Imports needing user correction divided by supported imports | Under 15%, segmented by layout |
| Return comprehension | Participants correctly distinguish contribution, gain and assumed projection | At least 80% in usability study |
| Monthly review retention | Activated users completing a review in days 22–45 divided by eligible activated users | Establish baseline, then target improvement |
| Material silent-error rate | Confirmed material undetected financial errors divided by audited imports | Zero known at release; investigate every occurrence |
| Backup readiness | Persistent-vault users who have verified a backup/restore or recovery flow | At least 80% before leaving onboarding |

These are hypotheses for pilot gates, not industry benchmarks. Segment by data quality, parser family, device and journey; never hide unsupported imports by reporting only successful files. Instrument import_started, type_detected, validation_failed, review_completed, scenario_saved, comparison_viewed and backup_verified using coarse categories.

Local-only operation limits centralized analytics. Use opt-in, first-party aggregate telemetry or voluntary exported diagnostics; lack of consent must not block features. Do not log balances, holdings, source filenames or custom goal names. Report the measured cohort and telemetry coverage so consent bias is visible. A 30-day freshness reminder is an in-app cue, not a promise of background email delivery.

## 15 Roadmap and operating model

The schedule below is a planning estimate conditional on a small cross-functional team: one product lead, one designer, two frontend engineers, one data/import engineer, shared QA and security, and part-time finance/legal reviewers. Staffing is unconfirmed. Phases are dependency-based; calendar promises follow discovery.

| Phase | Indicative duration | Deliverables | Exit gate |
| --- | --- | --- | --- |
| 0 Discovery and feasibility | 2–3 weeks | Interviews, sample corpus, advice/privacy opinion, data-rights review, parser and local-vault spikes | Supported-source list, architecture decision and risk owners agreed |
| 1 Planning foundation | 3–4 weeks | Calculator engine, goal builder, accessible chart system, scenarios and local persistence | Golden fixtures, offline journey and comprehension checks pass |
| 2 Import and portfolio alpha | 4–6 weeks | CAS adapters, generic CSV, staging, reconciliation, lineage, eligible returns and backups | Corpus targets, rollback and restore verified |
| 3 Controlled beta and launch | 3–4 weeks | Error recovery, export polish, security review, operational runbooks and pilot metrics | All P0 gates pass and material issues resolved |
| 4 Coverage and planning depth | 6–10 weeks after validation | Broker/depository formats, withdrawal planning, benchmarks, reference packages | Per-adapter certification and adequate data rights |
| 5 Expansion | Unscheduled | Household/sync, NPS/EPF parsers, advanced tax and probabilistic models | Separate demand, security, quantitative and regulatory gates |

Indicative sequential launch range is 12–17 weeks from approved staffing and access to representative files, not from this document's date. Parallel implementation may shorten elapsed time only after interfaces are stable; insufficient corpus coverage or regulatory uncertainty can extend it.

Product owns scope and comprehension; engineering owns reliability and migrations; finance reviewer owns calculation and accounting approval; security owns threat model and incident readiness; counsel owns legal interpretation; data operations owns source freshness, rights and reference publication. No individual is assumed assigned yet.

Release each parser behind a capability flag with independent rollback. Recheck source-download instructions at least monthly and before releases. Review reference packages at their stated frequency; if an update fails, mark the package overdue and retain the prior version. Reserve maintenance capacity for provider layout changes instead of treating imports as a one-time build.

## 16 Dependencies and risks

| Risk or dependency | Impact | Mitigation and owner |
| --- | --- | --- |
| Representative private statements unavailable | Parser quality cannot be certified | Consented redacted corpus before coverage promise; product/import lead |
| Provider layout drift | Wrong extraction or failed imports | Version detection, fail-closed validation and rollback; engineering |
| Incomplete history and absent cash ledger | Misleading personal returns | Eligibility rules and bounded-period calculation; finance/engineering |
| Ambiguous identities and duplicate custody views | Double-counted wealth | Account linkage review and multiplicity-safe matching; import lead |
| Browser eviction or forgotten passphrase | Permanent local loss | Verified backup, clear recovery model and quota handling; security/engineering |
| Public data lacks commercial rights | Reference-data distribution blocked | Licence review and user-import fallback; legal/data operations |
| Planning features cross advice boundaries | Registration or product redesign needed | Feature-level legal classification before launch; legal/product |
| Manual refresh feels inconvenient | Low retention and stale plans | Useful statement-only experience, dated values and guided refresh; design |
| Optimistic projections create false confidence | Poor financial decisions | Lower-return cases, inflation, liquidity and assumption disclosure; product/finance |
| Security exposure through scripts or support | Financial privacy breach | Local parsing, hardened app and minimized support access; security |
| Scope expands to every Indian asset at once | Delayed trustworthy launch | MF-first certified support and manual assets; product |
| Household assets allocated twice | Inflated goal readiness | Shared allocation ledger before household simulation; engineering |

Required decisions before implementation commitment: target user, exact no-API interpretation, local versus cloud preference, advisory boundary, first two or three statement layouts, data-rights approach, commercial model and capacity. Required decisions before public launch: legal applicability matrix, supported-browser policy, deletion/retention language, source maintenance ownership and a documented response to incorrect calculations.

## 17 Sources and evidence limitations

Sources were reviewed on 11 October 2026. Links establish provider capabilities or regulatory reference points; they do not certify complete coverage, current parser compatibility or legal compliance. Download instructions behind login and exact field layouts remain to be tested with authorized samples. The recommended architecture, product targets and feature priorities are original proposals.

- **S01** [KFintech consolidated account statement](https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement) — PDF mailback, consolidated scope, summary/detailed selections and password fields.
- **S02** [CAMS consolidated account statement](https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement) — official request surface; public extraction was limited, so KFintech documentation supports the specific format claims.
- **S03** [CAMS CAN based statement](https://www.camsonline.com/Investors/Statements/CAN-based-Statement) — CAN-specific scope and demat completeness caveat.
- **S04** [MFCentral](https://www.mfcentral.com/) — combined mutual fund services and portfolio positioning; authenticated export support not certified here.
- **S05** [CDSL CAS FAQ](https://www.cdslindia.com/CAS/FAQ.html) — statement coverage and consolidation basis.
- **S06** [SEBI investor guide to CAS](https://investor.sebi.gov.in/consolidated_account_statement.html) — consolidated securities/MF statement context.
- **S07** [Zerodha tradebook export guide](https://support.zerodha.com/category/console/reports/other-queries/articles/where-can-i-see-all-the-trades-i-ve-taken-for-a-particular-period) — CSV/XLSX downloads and external-trade distinctions.
- **S08** [EPFO employee information booklet](https://www.epfindia.gov.in/site_docs/PDFs/MiscPDFs/Employees_Information_Booklet.pdf) — passbook PDF download; current portal steps need revalidation.
- **S09** [NPS transaction statement guide](https://www.npscra.nsdl.co.in/download/pdf/KnowYourTransactionStatement.pdf) — statement sections and financial fields.
- **S10** [Protean CRA transaction statement notes](https://www.npscra.proteantech.in/transaction-statement-notes.php) — statement variants and current source location.
- **S11** [AMFI NAV download surface](https://www.amfiindia.com/net-asset-value) — official NAV source.
- **S12** [AMFI NAV history](https://www.amfiindia.com/net-asset-value/nav-history) — historical NAV discovery.
- **S13** [NSE reports](https://www.nseindia.com/all-reports) — downloadable market files and report format examples.
- **S14** [NSE data sharing and usage policy](https://www.nseindia.com/static/market-data/nse-data-policy) — terms relevant to use and distribution.
- **S15** [SEBI investment adviser regulations amended through November 2025](https://www.sebi.gov.in/legal/regulations/nov-2025/securities-and-exchange-board-of-india-investment-advisers-regulations-2013-and-securities-last-amended-on-november-25-2025-_98246.html) — regulatory framework for feature and business-model review.
- **S16** [SEBI investment adviser master circular February 2026](https://www.sebi.gov.in/sebi_data/attachdocs/feb-2026/1770375291405.pdf) — additional operating framework; counsel must check subsequent changes before launch.
- **S17** [Notified DPDP Rules 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) — phased commencement and data-protection requirements; read with Act commencement notifications and corrections.
- **S18** [CERT-In directions of 28 April 2022](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf) — incident and log requirements for covered entities.
- **S19** [CERT-In direction FAQs](https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf) — applicability and reporting clarifications.

## 18 Prioritized clarifying questions

### Priority 0 Decisions that change the product foundation

1. Who should the first release serve best: new SIP investors, existing investors consolidating portfolios, or households planning several goals?
2. Does “no external APIs” mean no third-party runtime dependencies, or must the application also avoid optional cloud storage, first-party sync and background downloads entirely?
3. Should personal data remain only on the user's device, or is optional encrypted cloud backup/sync desirable?
4. Is the intended product strictly a self-directed planning workspace, or should it eventually recommend specific investments and allocations under an appropriate regulated model?
5. Which actual statement sources matter most for launch, and can representative redacted exports be made available for certification?

### Priority 1 Decisions that shape launch scope

6. Is mutual-fund-first tracking with manual entry for other assets acceptable, or are stocks, EPF, PPF, NPS or deposits mandatory for the first release?
7. Which goal matters most initially: wealth accumulation, retirement, education, home purchase or general scenario exploration?
8. Should launch support one owner or a household, and are NRI or minor accounts required?
9. Which business model should be tested: free utility, subscription, one-time purchase or a professional offering?
10. What team, budget and target launch window are available, and is there an existing product or technical stack to build on?

### Priority 2 Decisions that refine the experience

11. Are English and a mobile-responsive web app sufficient initially, or are Hindi, other Indian languages or native apps required?
12. How often should users reasonably refresh their statements, and how much manual data maintenance is acceptable?
13. Which exports and sharing workflows matter most: personal PDF summaries, spreadsheet analysis or collaboration with a financial professional?
14. Are there preferred visual references, accessibility needs or brand constraints that should guide the design?
