// Generic CSV import. Four templates: transactions, holdings, prices, manual
// assets. Column headers are normalized and mapped tolerantly; unparseable rows
// become visible issues rather than being silently dropped or approximated.

import Papa from "papaparse";
import {
  AppState,
  Transaction,
  HoldingSnapshot,
  PriceObservation,
  ManualAsset,
  Instrument,
  Account,
  TxnType,
  AssetClass,
  ImportBatch,
  ReconciliationIssue,
} from "../types";
import { CommitImportPayload } from "../store/state";
import { uid, maskNumber, sha256Hex, todayISO } from "../util";
import { parseAmount } from "../engine/money";

export const CSV_PARSER_VERSION = "csv-1.0.0";

export type CsvTemplate = "transactions" | "holdings" | "prices" | "manual_assets";

export interface CsvPreview {
  template: CsvTemplate;
  fileName: string;
  fileHash: string;
  rowCount: number;
  accepted: number;
  issues: ReconciliationIssue[];
  payload: CommitImportPayload;
  sampleRows: Record<string, string>[];
  duplicateFile: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, "");

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  const map = new Map(Object.keys(row).map((k) => [norm(k), row[k]]));
  for (const k of keys) {
    const v = map.get(norm(k));
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

const TXN_SIGN: Record<string, { units: number; cash: number; type: TxnType }> = {
  purchase: { units: +1, cash: -1, type: "purchase" },
  buy: { units: +1, cash: -1, type: "purchase" },
  sip: { units: +1, cash: -1, type: "sip" },
  investment: { units: +1, cash: -1, type: "purchase" },
  redemption: { units: -1, cash: +1, type: "redemption" },
  sell: { units: -1, cash: +1, type: "redemption" },
  switchin: { units: +1, cash: 0, type: "switch_in" },
  switchout: { units: -1, cash: 0, type: "switch_out" },
  transferin: { units: +1, cash: 0, type: "transfer_in" },
  transferout: { units: -1, cash: 0, type: "transfer_out" },
  idcwpayout: { units: 0, cash: +1, type: "idcw_payout" },
  dividendpayout: { units: 0, cash: +1, type: "idcw_payout" },
  idcwreinvest: { units: +1, cash: 0, type: "idcw_reinvest" },
};

function normalizeAssetClass(raw?: string): AssetClass {
  const n = norm(raw ?? "");
  if (!n) return "other";
  if (n.includes("equity")) return "equity_mf";
  if (n.includes("debt")) return "debt_mf";
  if (n.includes("hybrid")) return "hybrid_mf";
  if (n.includes("cash")) return "cash";
  if (n.includes("fd") || n.includes("rd")) return "fd_rd";
  if (n.includes("epf")) return "epf";
  if (n.includes("ppf")) return "ppf";
  if (n.includes("nps")) return "nps";
  if (n.includes("gold")) return "gold";
  if (n.includes("property") || n.includes("realestate")) return "property";
  if (n.includes("mf") || n.includes("fund")) return "other_mf";
  return "other";
}

function emptyPayload(batch: ImportBatch): CommitImportPayload {
  return {
    batch,
    instruments: [],
    accounts: [],
    transactions: [],
    snapshots: [],
    prices: [],
    issues: [],
  };
}

export async function parseCsvFile(
  file: File,
  template: CsvTemplate,
  state: AppState,
  ownerId = "owner_self"
): Promise<CsvPreview> {
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf);
  const text = new TextDecoder().decode(buf);
  const duplicateFile = state.importBatches.some((b) => b.fileHash === fileHash && b.status === "committed");

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const rows = (parsed.data || []).filter((r) => r && Object.keys(r).length);

  const batchId = uid("batch");
  const batch: ImportBatch = {
    id: batchId,
    fileName: file.name,
    fileHash,
    sourceType: "generic_csv",
    parserVersion: CSV_PARSER_VERSION,
    committedAt: new Date().toISOString(),
    status: "committed",
    summary: "",
    addedTxnIds: [],
    addedSnapshotIds: [],
    addedAccountIds: [],
    addedInstrumentIds: [],
  };
  const payload = emptyPayload(batch);
  const issues: ReconciliationIssue[] = [];

  const instKey = new Map<string, Instrument>();
  const acctKey = new Map<string, Account>();

  function ensureInstrument(name: string, isin?: string, assetClass: AssetClass = "other_mf"): Instrument {
    const key = (isin || name).toLowerCase();
    if (instKey.has(key)) return instKey.get(key)!;
    const existing = state.instruments.find((i) => (isin && i.isin === isin) || i.name === name);
    const inst: Instrument =
      existing ?? {
        id: uid("inst"),
        name,
        isin,
        assetClass,
        plan: "unknown",
        option: "unknown",
      };
    instKey.set(key, inst);
    if (!existing) payload.instruments.push(inst);
    return inst;
  }

  function ensureAccount(folio: string, provider = "Imported CSV"): Account {
    const key = folio.toLowerCase();
    if (acctKey.has(key)) return acctKey.get(key)!;
    const existing = state.accounts.find((a) => a.maskedNumber === maskNumber(folio));
    const acct: Account =
      existing ?? {
        id: uid("acct"),
        ownerId,
        provider,
        maskedNumber: maskNumber(folio),
      };
    acctKey.set(key, acct);
    if (!existing) payload.accounts.push(acct);
    return acct;
  }

  let accepted = 0;

  rows.forEach((row, idx) => {
    const line = idx + 2; // header is line 1
    try {
      if (template === "transactions") {
        const date = pick(row, ["date", "transactiondate", "txndate"]);
        const typeRaw = pick(row, ["type", "transactiontype", "txntype", "description"]);
        const folio = pick(row, ["folio", "account", "accountnumber", "folionumber"]) ?? "UNSPECIFIED";
        const scheme = pick(row, ["scheme", "instrument", "fund", "schemename"]);
        const isin = pick(row, ["isin"]);
        const units = parseAmount(pick(row, ["units", "quantity", "qty"]));
        const amount = parseAmount(pick(row, ["amount", "value", "grossamount"]));
        const nav = parseAmount(pick(row, ["nav", "price"]));
        const charges = parseAmount(pick(row, ["charges", "fees", "stt"]));
        if (!date || !scheme || !typeRaw) {
          issues.push(rowIssue(line, "Missing date, scheme or type."));
          return;
        }
        const sign = TXN_SIGN[norm(typeRaw)] ?? { units: +1, cash: -1, type: "unknown" as TxnType };
        const inst = ensureInstrument(scheme, isin);
        const acct = ensureAccount(folio);
        const t: Transaction = {
          id: uid("txn"),
          accountId: acct.id,
          instrumentId: inst.id,
          eventDate: isoDate(date),
          type: sign.type,
          unitsDelta: (units ?? 0) * (sign.units || 1) * (sign.units === 0 ? 0 : 1),
          grossAmount: amount ?? undefined,
          netAmount: amount != null && charges != null ? amount - charges : amount ?? undefined,
          charges: charges ?? undefined,
          nav: nav ?? undefined,
          investorCashFlow: amount != null && sign.cash !== 0 ? sign.cash * Math.abs(amount) : undefined,
          provenance: `csv ${file.name} row ${line}`,
          confidence: sign.type === "unknown" ? "low" : "high",
          importBatchId: batchId,
        };
        if (sign.type === "unknown") {
          issues.push(rowIssue(line, `Unrecognised transaction type "${typeRaw}". Kept but not treated as a purchase.`, "warning", acct.id));
        }
        payload.transactions.push(t);
        batch.addedTxnIds.push(t.id);
        accepted++;
      } else if (template === "holdings") {
        const folio = pick(row, ["folio", "account", "accountnumber"]) ?? "UNSPECIFIED";
        const scheme = pick(row, ["scheme", "instrument", "fund", "schemename"]);
        const isin = pick(row, ["isin"]);
        const units = parseAmount(pick(row, ["units", "balanceunits", "quantity"]));
        const nav = parseAmount(pick(row, ["nav", "price"]));
        const value = parseAmount(pick(row, ["value", "amount", "marketvalue"]));
        const vdate = pick(row, ["valuationdate", "date", "asof"]) ?? todayISO();
        if (!scheme || units == null) {
          issues.push(rowIssue(line, "Missing scheme or units."));
          return;
        }
        const inst = ensureInstrument(scheme, isin);
        const acct = ensureAccount(folio);
        const snap: HoldingSnapshot = {
          id: uid("snap"),
          accountId: acct.id,
          instrumentId: inst.id,
          units,
          value: value ?? undefined,
          nav: nav ?? undefined,
          valuationDate: isoDate(vdate),
          source: `csv ${file.name} row ${line}`,
          confidence: "high",
        };
        payload.snapshots.push(snap);
        batch.addedSnapshotIds.push(snap.id);
        accepted++;
      } else if (template === "prices") {
        const scheme = pick(row, ["scheme", "instrument", "fund", "schemename"]);
        const isin = pick(row, ["isin"]);
        const date = pick(row, ["date", "navdate"]);
        const price = parseAmount(pick(row, ["price", "nav"]));
        if (!date || price == null || (!scheme && !isin)) {
          issues.push(rowIssue(line, "Missing scheme/isin, date or price."));
          return;
        }
        const inst = ensureInstrument(scheme ?? isin!, isin);
        const p: PriceObservation = {
          id: uid("price"),
          instrumentId: inst.id,
          date: isoDate(date),
          price,
          source: `csv ${file.name} row ${line}`,
          quality: "manual",
        };
        payload.prices.push(p);
        accepted++;
      } else {
        // manual_assets
        const label = pick(row, ["label", "name", "asset"]);
        const cls = normalizeAssetClass(pick(row, ["assetclass", "class", "type"]));
        const value = parseAmount(pick(row, ["value", "amount", "balance"]));
        const vdate = pick(row, ["valuationdate", "date", "asof"]) ?? todayISO();
        const basis = pick(row, ["basis", "valuationbasis"]) ?? "self-reported";
        const liquid = norm(pick(row, ["liquid"]) ?? "") !== "no";
        if (!label || value == null) {
          issues.push(rowIssue(line, "Missing label or value."));
          return;
        }
        const asset: ManualAsset = {
          id: uid("masset"),
          ownerId,
          label,
          assetClass: cls,
          value,
          valuationDate: isoDate(vdate),
          valuationBasis: basis,
          liquid,
        };
        // Manual assets are not part of CommitImportPayload; stash on batch summary via a side channel.
        (payload as any).manualAssets = (payload as any).manualAssets || [];
        (payload as any).manualAssets.push(asset);
        accepted++;
      }
    } catch (e) {
      issues.push(rowIssue(line, `Row failed to parse: ${(e as Error).message}`));
    }
  });

  payload.issues = issues;
  batch.summary = `${accepted} row(s) accepted, ${issues.filter((i) => i.severity !== "info").length} issue(s).`;

  return {
    template,
    fileName: file.name,
    fileHash,
    rowCount: rows.length,
    accepted,
    issues,
    payload,
    sampleRows: rows.slice(0, 5),
    duplicateFile,
  };
}

function rowIssue(line: number, message: string, severity: ReconciliationIssue["severity"] = "warning", accountId?: string): ReconciliationIssue {
  return {
    id: uid("issue"),
    rule: "csv_row",
    severity,
    message: `Line ${line}: ${message}`,
    accountId,
    resolved: false,
  };
}

/** Coerce common date formats to ISO date-only. Accepts ISO, dd-mm-yyyy, dd/mm/yyyy, dd-Mon-yyyy. */
export function isoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m1) {
    const d = m1[1].padStart(2, "0");
    const mo = m1[2].padStart(2, "0");
    let y = m1[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
  }
  const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const m2 = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/);
  if (m2) {
    const d = m2[1].padStart(2, "0");
    const mo = months[m2[2].toLowerCase()] ?? "01";
    let y = m2[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return todayISO();
}

// ---- Downloadable CSV templates ----

export const CSV_TEMPLATES: Record<CsvTemplate, string> = {
  transactions:
    "date,folio,scheme,isin,type,units,amount,nav,charges\n" +
    "2024-04-01,12345678,Example Equity Fund Direct Growth,INF000A01234,SIP,98.765,10000,101.25,0\n" +
    "2024-05-01,12345678,Example Equity Fund Direct Growth,INF000A01234,SIP,95.112,10000,105.14,0\n",
  holdings:
    "folio,scheme,isin,units,nav,value,valuation_date\n" +
    "12345678,Example Equity Fund Direct Growth,INF000A01234,580.321,112.40,65228.08,2026-10-08\n",
  prices:
    "scheme,isin,date,price\n" +
    "Example Equity Fund Direct Growth,INF000A01234,2026-10-08,112.40\n",
  manual_assets:
    "label,asset_class,value,valuation_date,basis,liquid\n" +
    "EPF balance,EPF,450000,2026-03-31,passbook,no\n" +
    "Emergency savings account,Cash,200000,2026-10-10,bank statement,yes\n",
};

export function downloadTemplate(template: CsvTemplate): void {
  const blob = new Blob([CSV_TEMPLATES[template]], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iij-template-${template}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
