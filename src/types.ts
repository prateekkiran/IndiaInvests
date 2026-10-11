// Core domain model (PRD §10). All identifiers are local; no server identity.

export type AssetClass =
  | "equity_mf"
  | "debt_mf"
  | "hybrid_mf"
  | "other_mf"
  | "cash"
  | "fd_rd"
  | "epf"
  | "ppf"
  | "nps"
  | "gold"
  | "property"
  | "other";

export type Plan = "direct" | "regular" | "unknown";
export type Option = "growth" | "idcw_payout" | "idcw_reinvest" | "unknown";

export interface Owner {
  id: string;
  label: string; // display label only; no full PAN/Aadhaar
}

export interface Preferences {
  currency: "INR";
  dateFormat: "dd_mmm_yyyy";
  fiscalYearStartMonth: 4; // April
  privacyMaskBalances: boolean;
  defaultAnnualReturn: number; // illustrative only
  defaultInflation: number;
}

export interface Instrument {
  id: string;
  name: string;
  isin?: string;
  schemeCode?: string;
  assetClass: AssetClass;
  plan: Plan;
  option: Option;
  fundHouse?: string;
  aliases?: string[];
}

export interface Account {
  id: string;
  ownerId: string;
  provider: string; // e.g. "CAMS", "KFintech", "Zerodha", "Manual"
  custody?: string; // e.g. "CDSL", "NSDL", "AMC"
  maskedNumber: string; // folio/account, masked
  holdingPattern?: string; // single / joint
}

export type TxnType =
  | "purchase"
  | "sip"
  | "redemption"
  | "switch_in"
  | "switch_out"
  | "transfer_in"
  | "transfer_out"
  | "idcw_payout"
  | "idcw_reinvest"
  | "bonus"
  | "split"
  | "reversal"
  | "unknown";

export interface Transaction {
  id: string;
  accountId: string;
  instrumentId: string;
  eventDate: string; // ISO date-only
  settlementDate?: string;
  type: TxnType;
  unitsDelta: number; // signed in unit direction (+in / -out)
  grossAmount?: number;
  netAmount?: number;
  charges?: number;
  nav?: number;
  /** +ve = investor pays in (negative cash flow), used for XIRR cash-flow direction. */
  investorCashFlow?: number;
  sourceTxnId?: string;
  linkedEventIds?: string[];
  reversed?: boolean;
  importBatchId?: string;
  provenance?: string; // "statement p.3 row 12" / "manual" / "csv row 8"
  confidence?: "high" | "medium" | "low";
}

export interface HoldingSnapshot {
  id: string;
  accountId: string;
  instrumentId: string;
  units: number;
  value?: number;
  valuationDate: string; // ISO
  nav?: number;
  source: string;
  confidence?: "high" | "medium" | "low";
}

export interface PriceObservation {
  id: string;
  instrumentId: string;
  date: string; // ISO
  price: number;
  source: string;
  quality: "statement" | "manual" | "package" | "override";
  overrideReason?: string;
}

export interface ManualAsset {
  id: string;
  ownerId: string;
  label: string;
  assetClass: AssetClass;
  value: number;
  valuationDate: string;
  valuationBasis: string; // e.g. "latest passbook", "self-estimate"
  liquid: boolean;
  note?: string;
}

export interface ManualLiability {
  id: string;
  ownerId: string;
  label: string;
  balance: number;
  valuationDate: string;
  note?: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileHash: string;
  sourceType: string; // "generic_csv" | "cams_kfintech_cas" | "manual"
  parserVersion: string;
  period?: { from?: string; to?: string };
  committedAt: string;
  status: "committed" | "reversed";
  summary: string;
  addedTxnIds: string[];
  addedSnapshotIds: string[];
  addedAccountIds: string[];
  addedInstrumentIds: string[];
}

export type IssueSeverity = "info" | "warning" | "blocking";

export interface ReconciliationIssue {
  id: string;
  rule: string;
  severity: IssueSeverity;
  message: string;
  accountId?: string;
  instrumentId?: string;
  discrepancy?: number;
  resolved: boolean;
}

// ---- Goals & allocation (PRD §6 GOAL01..03, §7 F12) ----

export type AmountBasis = "today" | "future";

export interface ContributionStream {
  id: string;
  label: string;
  monthlyAmount: number;
  annualStepUp: number; // fraction
  timing: "end" | "begin";
}

export interface GoalAllocation {
  /** Portion of a specific asset (manual asset id or instrument-in-account) allocated, 0..1. */
  assetRef: string;
  fraction: number;
}

export interface Goal {
  id: string;
  label: string;
  template?: "emergency" | "education" | "home" | "retirement" | "custom";
  amount: number;
  amountBasis: AmountBasis;
  targetDate: string; // ISO
  priority: number;
  annualInflation: number;
  annualReturn: number; // assumed, user-editable
  allocations: GoalAllocation[];
  contributionStreamIds: string[];
}

// ---- Calculator scenarios (PRD §6 CAL01..04) ----

export type CalculatorKind =
  | "sip"
  | "lumpsum"
  | "stepup"
  | "goal_future"
  | "required_sip"
  | "inflation";

export interface ScenarioInputs {
  kind: CalculatorKind;
  monthlyContribution?: number;
  lumpSum?: number;
  annualReturn: number;
  annualInflation: number;
  years: number;
  timing: "end" | "begin";
  annualStepUp?: number;
  goalAmountToday?: number;
  goalAmountBasis?: AmountBasis;
  openingBalance?: number;
  pauses?: number[];
  oneTime?: Array<{ month: number; amount: number }>;
}

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  inputs: ScenarioInputs;
  /** Result checksum lets us detect reference/engine drift when reopened. */
  engineVersion: string;
  sample?: boolean; // clearly fictional sample data
}

export interface AppState {
  schemaVersion: number;
  engineVersion: string;
  createdAt: string;
  updatedAt: string;
  owners: Owner[];
  preferences: Preferences;
  instruments: Instrument[];
  accounts: Account[];
  transactions: Transaction[];
  snapshots: HoldingSnapshot[];
  prices: PriceObservation[];
  manualAssets: ManualAsset[];
  manualLiabilities: ManualLiability[];
  importBatches: ImportBatch[];
  issues: ReconciliationIssue[];
  goals: Goal[];
  contributionStreams: ContributionStream[];
  savedScenarios: SavedScenario[];
  lastBackupAt?: string;
}

export const SCHEMA_VERSION = 1;
export const ENGINE_VERSION = "engine-1.0.0";
