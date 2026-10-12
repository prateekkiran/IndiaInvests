// Broker CSV adapters. Indian brokers/platforms each export mutual-fund
// transaction CSVs with their own column names. An adapter is just (a) a header
// signature used to auto-detect the source and (b) alias lists + type words
// that teach the existing generic CSV parser how to read that layout. No new
// runtime dependency; all dedup/preview/rollback logic in csv.ts is reused.
//
// We NEVER guess a broker from data values — only from header tokens. If no
// adapter matches confidently, the generic template is used and the user is
// told which adapter (if any) was detected.

import { TxnType } from "../types";

export interface BrokerFieldAliases {
  date?: string[];
  folio?: string[];
  scheme?: string[];
  isin?: string[];
  type?: string[];
  units?: string[];
  amount?: string[];
  nav?: string[];
  charges?: string[];
}

export interface BrokerAdapter {
  id: string;
  label: string;
  /** Normalised header tokens that strongly identify this export. */
  signature: string[];
  aliases: BrokerFieldAliases;
  /** Extra transaction-type words → direction, merged over the defaults. */
  typeMap?: Record<string, { units: number; cash: number; type: TxnType }>;
  notes?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_()./-]+/g, "");

export const BROKER_ADAPTERS: BrokerAdapter[] = [
  {
    id: "zerodha_coin",
    label: "Zerodha Coin",
    signature: ["tradedate", "isin", "trade", "amount"],
    aliases: {
      date: ["trade_date", "tradedate", "order_date"],
      scheme: ["symbol", "tradingsymbol", "scheme_name", "fund"],
      isin: ["isin"],
      type: ["trade_type", "transaction_type", "buy_sell", "trade"],
      units: ["quantity", "units", "qty"],
      amount: ["amount", "trade_value", "net_amount"],
      nav: ["price", "nav", "average_price"],
      folio: ["folio", "folio_no"],
    },
    typeMap: {
      buy: { units: +1, cash: -1, type: "purchase" },
      b: { units: +1, cash: -1, type: "purchase" },
      sell: { units: -1, cash: +1, type: "redemption" },
      s: { units: -1, cash: +1, type: "redemption" },
    },
    notes: "Coin console mutual-fund tradebook export.",
  },
  {
    id: "groww",
    label: "Groww",
    signature: ["schemename", "transactiontype", "nav", "units"],
    aliases: {
      date: ["transaction_date", "date", "order_date"],
      scheme: ["scheme_name", "scheme", "fund_name"],
      isin: ["isin"],
      type: ["transaction_type", "type", "order_type"],
      units: ["units", "quantity"],
      amount: ["amount", "transaction_amount"],
      nav: ["nav", "price", "allotment_nav"],
      folio: ["folio_number", "folio"],
    },
    typeMap: {
      invest: { units: +1, cash: -1, type: "purchase" },
      purchase: { units: +1, cash: -1, type: "purchase" },
      sip: { units: +1, cash: -1, type: "sip" },
      redeem: { units: -1, cash: +1, type: "redemption" },
      withdraw: { units: -1, cash: +1, type: "redemption" },
    },
    notes: "Groww mutual-fund order/transaction export.",
  },
  {
    id: "kuvera",
    label: "Kuvera",
    signature: ["folio", "isin", "nav", "transactiontype"],
    aliases: {
      date: ["date", "transaction_date"],
      scheme: ["name", "scheme_name", "fund"],
      isin: ["isin"],
      type: ["transaction_type", "type", "order"],
      units: ["units", "quantity"],
      amount: ["amount", "value"],
      nav: ["nav", "price"],
      folio: ["folio", "folio_number"],
    },
    notes: "Kuvera transactions export.",
  },
  {
    id: "mfcentral",
    label: "MF Central",
    signature: ["folio", "amc", "schemename", "transactiontype"],
    aliases: {
      date: ["transaction_date", "date", "txn_date"],
      scheme: ["scheme_name", "scheme", "product"],
      isin: ["isin"],
      type: ["transaction_type", "txn_type", "type"],
      units: ["units", "unit_balance_change", "quantity"],
      amount: ["amount", "transaction_amount"],
      nav: ["nav", "price"],
      folio: ["folio", "folio_no"],
    },
    notes: "MF Central consolidated transaction export.",
  },
];

export interface BrokerDetection {
  adapter: BrokerAdapter | null;
  score: number; // fraction of signature tokens matched for the best adapter
  matchedTokens: string[];
}

/** Detect the best broker adapter from CSV header names. */
export function detectBroker(headers: string[]): BrokerDetection {
  const normHeaders = new Set(headers.map(norm));
  let best: BrokerAdapter | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const a of BROKER_ADAPTERS) {
    const matched = a.signature.filter((sig) => {
      // A signature token matches if any header contains it (normalised).
      for (const h of normHeaders) if (h.includes(sig)) return true;
      return false;
    });
    const score = matched.length / a.signature.length;
    if (score > bestScore) {
      bestScore = score;
      best = a;
      bestMatched = matched;
    }
  }
  // Require at least 3 of 4 signature tokens to claim a confident match.
  if (bestScore < 0.75) return { adapter: null, score: bestScore, matchedTokens: bestMatched };
  return { adapter: best, score: bestScore, matchedTokens: bestMatched };
}
