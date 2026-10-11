// Best-effort CAMS / KFintech Consolidated Account Statement (CAS) PDF reader.
//
// IMPORTANT (PRD IMP01): we never silently fall through to approximate
// extraction. If the document lacks recognizable CAS structure, we return an
// `unsupported` result and point the user to CSV / manual entry. Encrypted text
// PDFs are decrypted locally with the user-supplied password; the password is
// never logged or stored. Image-only (scanned) PDFs are rejected (OCR is P2).

import {
  AppState,
  Transaction,
  Instrument,
  Account,
  ImportBatch,
  ReconciliationIssue,
  TxnType,
} from "../types";
import { CommitImportPayload } from "../store/state";
import { uid, maskNumber, sha256Hex } from "../util";
import { parseAmount } from "../engine/money";
import { isoDate } from "./csv";

export const CAS_PARSER_VERSION = "cas-0.9.0-beta";

export type CasOutcome = "parsed" | "unsupported" | "wrong-password" | "scanned" | "error";

export interface CasResult {
  outcome: CasOutcome;
  message: string;
  fileName: string;
  fileHash?: string;
  duplicateFile?: boolean;
  foliosDetected?: number;
  txnDetected?: number;
  payload?: CommitImportPayload;
  issues?: ReconciliationIssue[];
}

const CAS_MARKERS = [
  "consolidated account statement",
  "cams",
  "kfintech",
  "karvy",
  "folio no",
  "nav on",
];

async function loadPdfText(buf: ArrayBuffer, password?: string): Promise<{ text: string; pages: number } | { error: CasOutcome; message: string }> {
  const pdfjs = await import("pdfjs-dist");
  // Vite worker wiring.
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (workerMod as any).default;
  try {
    const task = (pdfjs as any).getDocument({ data: new Uint8Array(buf), password });
    const doc = await task.promise;
    let text = "";
    let totalChars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
      totalChars += strings.replace(/\s/g, "").length;
      text += "\n" + strings;
    }
    if (totalChars < 40 * doc.numPages && totalChars < 400) {
      return { error: "scanned", message: "This looks like a scanned / image-only PDF. Text extraction isn't possible. Use the CSV template or enter holdings manually." };
    }
    return { text, pages: doc.numPages };
  } catch (e: any) {
    const name = e?.name || "";
    if (name === "PasswordException" || /password/i.test(e?.message ?? "")) {
      return { error: "wrong-password", message: "A correct PDF password is required to open this statement." };
    }
    return { error: "error", message: `Could not read the PDF: ${e?.message ?? "unknown error"}` };
  }
}

const TXN_WORD: Array<{ re: RegExp; type: TxnType; units: number; cash: number }> = [
  { re: /purchase|sip|systematic investment|investment/i, type: "sip", units: +1, cash: -1 },
  { re: /redemption|redeem|withdrawal/i, type: "redemption", units: -1, cash: +1 },
  { re: /switch[\s-]*in/i, type: "switch_in", units: +1, cash: 0 },
  { re: /switch[\s-]*out/i, type: "switch_out", units: -1, cash: 0 },
  { re: /dividend reinvest|idcw reinvest/i, type: "idcw_reinvest", units: +1, cash: 0 },
  { re: /dividend payout|idcw payout/i, type: "idcw_payout", units: 0, cash: +1 },
];

function classify(narration: string): { type: TxnType; units: number; cash: number } {
  for (const w of TXN_WORD) if (w.re.test(narration)) return { type: w.type, units: w.units, cash: w.cash };
  return { type: "unknown", units: +1, cash: -1 };
}

export async function parseCasPdf(
  file: File,
  password: string | undefined,
  state: AppState,
  ownerId = "owner_self"
): Promise<CasResult> {
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf.slice(0));
  const duplicateFile = state.importBatches.some((b) => b.fileHash === fileHash && b.status === "committed");

  const loaded = await loadPdfText(buf, password);
  if ("error" in loaded) {
    return { outcome: loaded.error, message: loaded.message, fileName: file.name, fileHash, duplicateFile };
  }

  const { text, pages } = loaded;
  const lower = text.toLowerCase();
  const markerHits = CAS_MARKERS.filter((m) => lower.includes(m)).length;
  if (markerHits < 2) {
    return {
      outcome: "unsupported",
      message:
        "This PDF doesn't match a recognised CAMS/KFintech CAS layout, so it won't be parsed to avoid guessing. Please use the CSV template or enter holdings manually.",
      fileName: file.name,
      fileHash,
      duplicateFile,
    };
  }

  const batchId = uid("batch");
  const batch: ImportBatch = {
    id: batchId,
    fileName: file.name,
    fileHash,
    sourceType: "cams_kfintech_cas",
    parserVersion: CAS_PARSER_VERSION,
    committedAt: new Date().toISOString(),
    status: "committed",
    summary: "",
    addedTxnIds: [],
    addedSnapshotIds: [],
    addedAccountIds: [],
    addedInstrumentIds: [],
  };
  const payload: CommitImportPayload = {
    batch,
    instruments: [],
    accounts: [],
    transactions: [],
    snapshots: [],
    prices: [],
    issues: [],
  };
  const issues: ReconciliationIssue[] = [];

  // Normalise into pseudo-lines around dates (CAS text extraction loses newlines).
  const dateToken = /(\d{2}-[A-Za-z]{3}-\d{4})/g;
  const segments = text.split(/(?=\d{2}-[A-Za-z]{3}-\d{4})/);

  let currentFolio = "UNSPECIFIED";
  let currentScheme = "Unidentified scheme";
  let currentIsin: string | undefined;
  const instByKey = new Map<string, Instrument>();
  const acctByKey = new Map<string, Account>();
  let txnCount = 0;
  const folios = new Set<string>();

  function ensureInstrument(): Instrument {
    const key = (currentIsin || currentScheme).toLowerCase();
    if (instByKey.has(key)) return instByKey.get(key)!;
    const existing = state.instruments.find((i) => (currentIsin && i.isin === currentIsin) || i.name === currentScheme);
    const inst: Instrument =
      existing ?? {
        id: uid("inst"),
        name: currentScheme,
        isin: currentIsin,
        assetClass: "other_mf",
        plan: /direct/i.test(currentScheme) ? "direct" : /regular/i.test(currentScheme) ? "regular" : "unknown",
        option: /idcw|dividend/i.test(currentScheme) ? "idcw_payout" : /growth/i.test(currentScheme) ? "growth" : "unknown",
      };
    instByKey.set(key, inst);
    if (!existing) payload.instruments.push(inst);
    return inst;
  }
  function ensureAccount(): Account {
    const key = currentFolio.toLowerCase();
    if (acctByKey.has(key)) return acctByKey.get(key)!;
    const acct: Account = {
      id: uid("acct"),
      ownerId,
      provider: lower.includes("kfintech") || lower.includes("karvy") ? "KFintech" : "CAMS",
      maskedNumber: maskNumber(currentFolio),
    };
    acctByKey.set(key, acct);
    payload.accounts.push(acct);
    batch.addedAccountIds.push(acct.id);
    return acct;
  }

  for (const seg of segments) {
    const folioM = seg.match(/folio no[:\s]*([\w/ ]+?)(?:\s{2,}|isin|pan|$)/i);
    if (folioM) {
      currentFolio = folioM[1].trim().split(/\s/)[0];
      folios.add(currentFolio);
    }
    const isinM = seg.match(/\b([A-Z]{2}[0-9A-Z]{9}\d)\b/);
    if (isinM) currentIsin = isinM[1];
    const schemeM = seg.match(/([A-Za-z][A-Za-z0-9 .&()\-]+?(?:fund|plan|scheme)[A-Za-z0-9 .&()\-]*)/i);
    if (schemeM && schemeM[1].length > 8) currentScheme = schemeM[1].replace(/\s+/g, " ").trim();

    const dm = seg.match(dateToken);
    if (!dm) continue;
    // Pull the leading date and the first few numeric tokens after the narration.
    const date = dm[0];
    const rest = seg.slice(seg.indexOf(date) + date.length);
    const narration = rest.slice(0, 60);
    const nums = (rest.match(/\(?-?[\d,]+\.\d{2,4}\)?/g) || []).map((n) => parseAmount(n));
    if (nums.length < 2) continue;

    const cls = classify(narration);
    // Heuristic column order for CAS: amount, units, nav, balance-units
    const amount = nums[0] ?? undefined;
    const units = nums[1] ?? undefined;
    const nav = nums[2] ?? undefined;

    const inst = ensureInstrument();
    const acct = ensureAccount();
    const t: Transaction = {
      id: uid("txn"),
      accountId: acct.id,
      instrumentId: inst.id,
      eventDate: isoDate(date),
      type: cls.type,
      unitsDelta: cls.units === 0 ? 0 : Math.abs(units ?? 0) * cls.units,
      grossAmount: amount != null ? Math.abs(amount) : undefined,
      nav: nav ?? undefined,
      investorCashFlow: amount != null && cls.cash !== 0 ? cls.cash * Math.abs(amount) : undefined,
      provenance: `CAS ${file.name}`,
      confidence: cls.type === "unknown" ? "low" : "medium",
      importBatchId: batchId,
    };
    payload.transactions.push(t);
    batch.addedTxnIds.push(t.id);
    txnCount++;
    if (cls.type === "unknown") {
      issues.push({
        id: uid("issue"),
        rule: "cas_unknown_txn",
        severity: "warning",
        message: `Unrecognised transaction near ${isoDate(date)} in folio ${maskNumber(currentFolio)} — review before relying on it.`,
        accountId: acct.id,
        resolved: false,
      });
    }
  }

  if (txnCount === 0) {
    return {
      outcome: "unsupported",
      message:
        "Recognised a CAS header but could not confidently extract any transactions. Please use the CSV template or enter holdings manually rather than risk fabricated data.",
      fileName: file.name,
      fileHash,
      duplicateFile,
    };
  }

  issues.push({
    id: uid("issue"),
    rule: "cas_beta",
    severity: "warning",
    message:
      "CAS PDF parsing is a best-effort beta. Review every extracted row against your statement before committing; amounts, units and NAVs may need correction.",
    resolved: false,
  });

  payload.issues = issues;
  batch.summary = `${txnCount} transaction(s) across ${folios.size || 1} folio(s) from ${pages} page(s). Review required.`;

  return {
    outcome: "parsed",
    message: batch.summary,
    fileName: file.name,
    fileHash,
    duplicateFile,
    foliosDetected: folios.size || acctByKey.size,
    txnDetected: txnCount,
    payload,
    issues,
  };
}
