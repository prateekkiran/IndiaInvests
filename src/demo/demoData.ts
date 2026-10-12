// Seeded demo account — a complete, clearly-fictional persona ("Asha, a demo
// investor") that populates EVERY module so a new user can explore the whole
// platform in one click: portfolio with real transactions (so XIRR works), a
// monthly NAV series (so Value history plots), manual assets + a liability,
// multiple goals at different funding levels, a household budget with life
// events, and pre-saved calculator scenarios to compare.
//
// Everything here is deterministic (no randomness) and marked demo:true so the
// app never persists it over a real vault. All identifiers are generated fresh
// per load. Values are illustrative and obviously synthetic.

import {
  AppState,
  SCHEMA_VERSION,
  ENGINE_VERSION,
  Instrument,
  Account,
  Transaction,
  PriceObservation,
  HoldingSnapshot,
  ManualAsset,
  ManualLiability,
  Goal,
  ContributionStream,
  SavedScenario,
  ImportBatch,
} from "../types";
import { uid, todayISO, addMonthsISO } from "../util";

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Deterministic NAV path: a gentle upward drift with a smooth wobble. */
function navAt(base: number, monthIndex: number, drift: number, wobble: number): number {
  const growth = Math.pow(1 + drift, monthIndex);
  const wave = 1 + Math.sin(monthIndex / 3) * wobble;
  return Number((base * growth * wave).toFixed(4));
}

export function buildDemoState(): AppState {
  const now = new Date().toISOString();
  const today = todayISO();
  const ownerId = "owner_self";

  // --- Accounts ---
  const camsAcct: Account = { id: uid("acct"), ownerId, provider: "Demo (CAMS)", maskedNumber: "••••7421", holdingPattern: "single" };
  const kfinAcct: Account = { id: uid("acct"), ownerId, provider: "Demo (KFintech)", maskedNumber: "••••3098", holdingPattern: "single" };

  // --- Instruments ---
  const eq: Instrument = { id: uid("inst"), name: "Demo Bluechip Equity — Direct Growth", isin: "INF000DEMO01", assetClass: "equity_mf", plan: "direct", option: "growth", fundHouse: "Demo AMC" };
  const flexi: Instrument = { id: uid("inst"), name: "Demo Flexi Cap — Direct Growth", isin: "INF000DEMO02", assetClass: "equity_mf", plan: "direct", option: "growth", fundHouse: "Demo AMC" };
  const debt: Instrument = { id: uid("inst"), name: "Demo Short Duration Debt — Direct Growth", isin: "INF000DEMO03", assetClass: "debt_mf", plan: "direct", option: "growth", fundHouse: "Demo AMC" };
  const instruments = [eq, flexi, debt];

  const MONTHS = 36;
  const transactions: Transaction[] = [];
  const prices: PriceObservation[] = [];
  const batchId = uid("batch");

  // Per-instrument SIP + monthly NAV series.
  const plans = [
    { inst: eq, acct: camsAcct, sip: 15000, base: 72, drift: 0.012, wobble: 0.05 },
    { inst: flexi, acct: camsAcct, sip: 10000, base: 48, drift: 0.013, wobble: 0.07 },
    { inst: debt, acct: kfinAcct, sip: 8000, base: 34, drift: 0.006, wobble: 0.015 },
  ];

  for (const p of plans) {
    for (let m = 0; m <= MONTHS; m++) {
      const monthIdx = MONTHS - m; // 0 = oldest
      const date = isoMonthsAgo(m);
      const nav = navAt(p.base, MONTHS - m, p.drift, p.wobble);
      // Monthly NAV observation (package quality → drives Value history).
      prices.push({ id: uid("price"), instrumentId: p.inst.id, date, price: nav, source: "Demo NAV pack (fictional)", quality: "package" });
      // SIP on every month except the current one (allotment lag).
      if (m > 0) {
        const units = Number((p.sip / nav).toFixed(4));
        const tid = uid("txn");
        transactions.push({
          id: tid, accountId: p.acct.id, instrumentId: p.inst.id, eventDate: date, type: "sip",
          unitsDelta: units, grossAmount: p.sip, netAmount: p.sip, nav, investorCashFlow: -p.sip,
          provenance: "demo", confidence: "high", importBatchId: batchId,
        });
      }
    }
  }

  const addedTxnIds = transactions.map((t) => t.id);
  const batch: ImportBatch = {
    id: batchId, fileName: "Demo account (fictional)", fileHash: "demo-" + batchId, sourceType: "demo",
    parserVersion: "demo-1.0.0", committedAt: now, status: "committed",
    summary: `${transactions.length} demo SIP transactions across 3 funds, with a 36-month NAV series.`,
    addedTxnIds, addedSnapshotIds: [], addedAccountIds: [camsAcct.id, kfinAcct.id], addedInstrumentIds: instruments.map((i) => i.id),
  };

  // A holdings-only snapshot would duplicate; skip it — transactions already drive holdings.
  const snapshots: HoldingSnapshot[] = [];

  // --- Manual assets & liability ---
  const epf: ManualAsset = { id: uid("masset"), ownerId, label: "EPF balance", assetClass: "epf", value: 540000, valuationDate: "2026-03-31", valuationBasis: "passbook", liquid: false };
  const ppf: ManualAsset = { id: uid("masset"), ownerId, label: "PPF account", assetClass: "ppf", value: 310000, valuationDate: "2026-03-31", valuationBasis: "passbook", liquid: false };
  const gold: ManualAsset = { id: uid("masset"), ownerId, label: "Sovereign Gold Bonds", assetClass: "gold", value: 180000, valuationDate: today, valuationBasis: "self-estimate", liquid: false };
  const cash: ManualAsset = { id: uid("masset"), ownerId, label: "Emergency savings", assetClass: "cash", value: 250000, valuationDate: today, valuationBasis: "bank statement", liquid: true };
  const manualAssets = [epf, ppf, gold, cash];
  const manualLiabilities: ManualLiability[] = [
    { id: uid("liab"), ownerId, label: "Car loan", balance: 320000, valuationDate: today },
  ];

  // --- Contribution streams ---
  const eqStream: ContributionStream = { id: uid("stream"), label: "Equity SIP", monthlyAmount: 25000, annualStepUp: 0.1, timing: "end" };
  const debtStream: ContributionStream = { id: uid("stream"), label: "Debt SIP", monthlyAmount: 8000, annualStepUp: 0, timing: "end" };
  const contributionStreams = [eqStream, debtStream];

  // --- Goals (varied funding levels) ---
  const eqRef = `${camsAcct.id}::${eq.id}`;
  const cashRef = cash.id;
  const ppfRef = ppf.id;
  const epfRef = epf.id;
  const goals: Goal[] = [
    {
      id: uid("goal"), label: "Emergency reserve", template: "emergency", amount: 600000, amountBasis: "today",
      targetDate: addMonthsISO(today, 12), priority: 1, annualInflation: 0.06, annualReturn: 0.06,
      allocations: [{ assetRef: cashRef, fraction: 1 }], contributionStreamIds: [],
    },
    {
      id: uid("goal"), label: "Child's education", template: "education", amount: 4000000, amountBasis: "today",
      targetDate: addMonthsISO(today, 180), priority: 2, annualInflation: 0.07, annualReturn: 0.11,
      allocations: [{ assetRef: eqRef, fraction: 0.5 }, { assetRef: ppfRef, fraction: 1 }], contributionStreamIds: [eqStream.id],
    },
    {
      id: uid("goal"), label: "Home down payment", template: "home", amount: 2000000, amountBasis: "today",
      targetDate: addMonthsISO(today, 72), priority: 3, annualInflation: 0.06, annualReturn: 0.09,
      allocations: [{ assetRef: eqRef, fraction: 0.3 }], contributionStreamIds: [debtStream.id],
    },
    {
      id: uid("goal"), label: "Retirement", template: "retirement", amount: 30000000, amountBasis: "today",
      targetDate: addMonthsISO(today, 300), priority: 4, annualInflation: 0.06, annualReturn: 0.11,
      allocations: [{ assetRef: epfRef, fraction: 1 }, { assetRef: eqRef, fraction: 0.2 }], contributionStreamIds: [eqStream.id],
    },
  ];

  // --- Saved calculator scenarios to compare in Explore ---
  const savedScenarios: SavedScenario[] = [
    {
      id: uid("scn"), name: "SIP · 20y @ 11%", createdAt: today, engineVersion: ENGINE_VERSION,
      inputs: { kind: "sip", monthlyContribution: 25000, annualReturn: 0.11, annualInflation: 0.06, years: 20, timing: "end", annualStepUp: 0.1 },
    },
    {
      id: uid("scn"), name: "Step-up SIP · 20y @ 11%", createdAt: today, engineVersion: ENGINE_VERSION,
      inputs: { kind: "stepup", monthlyContribution: 25000, annualReturn: 0.11, annualInflation: 0.06, years: 20, timing: "end", annualStepUp: 0.1 },
    },
    {
      id: uid("scn"), name: "Retirement drawdown · 30y", createdAt: today, engineVersion: ENGINE_VERSION,
      inputs: { kind: "retirement", openingBalance: 30000000, withdrawalMonthly: 120000, withdrawalInflates: true, pensionMonthly: 25000, annualReturn: 0.08, annualInflation: 0.06, years: 30, timing: "end" },
    },
    {
      id: uid("scn"), name: "SWP · ₹40k/mo for 25y", createdAt: today, engineVersion: ENGINE_VERSION,
      inputs: { kind: "swp", openingBalance: 10000000, withdrawalMonthly: 40000, withdrawalInflates: true, annualReturn: 0.08, annualInflation: 0.06, years: 25, timing: "end" },
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    createdAt: now,
    updatedAt: now,
    demo: true,
    owners: [{ id: ownerId, label: "Asha (demo)" }],
    preferences: {
      currency: "INR", dateFormat: "dd_mmm_yyyy", fiscalYearStartMonth: 4,
      privacyMaskBalances: false, defaultAnnualReturn: 0.11, defaultInflation: 0.06,
    },
    instruments,
    accounts: [camsAcct, kfinAcct],
    transactions,
    snapshots,
    prices,
    manualAssets,
    manualLiabilities,
    importBatches: [batch],
    issues: [],
    goals,
    contributionStreams,
    savedScenarios,
    household: {
      monthlyBudget: 60000,
      annualStepUp: 0.05,
      lifeEvents: [
        { id: uid("evt"), label: "Annual bonus", date: addMonthsISO(today, 4), amount: 200000, type: "income" },
        { id: uid("evt"), label: "Family trip", date: addMonthsISO(today, 10), amount: 150000, type: "expense" },
        { id: uid("evt"), label: "New car", date: addMonthsISO(today, 24), amount: 500000, type: "expense" },
      ],
    },
  };
}
