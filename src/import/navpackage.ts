// Governed offline NAV-history package (REF01/REF02, POR03).
//
// A NAV package is a plain JSON file the user obtains and keeps themselves —
// there is NO network fetch. It carries explicit provenance (source, retrieved
// date, optional licence) and, per series, dated NAVs. Importing it creates
// `package`-quality PriceObservations, each stamped with the package source and
// its own effective date, so value history can be drawn from observed points
// (never a fabricated smooth curve).
//
// We validate structure strictly and reject anything malformed rather than
// importing partial/approximate data. Re-importing the same (instrument, date)
// at package quality is idempotent — handled by the reducer's merge-by-id plus
// the dedupe here.

import { AppState, PriceObservation, Instrument } from "../types";
import { CommitImportPayload } from "../store/state";
import { uid, sha256Hex } from "../util";

export const NAV_PACKAGE_FORMAT = "iij-nav-package";
export const NAV_PACKAGE_VERSION = 1;

export interface NavPackageSeries {
  isin?: string;
  scheme?: string;
  navs: Array<{ date: string; nav: number }>;
}

export interface NavPackage {
  format: string;
  version: number;
  source: string;
  retrievedDate: string;
  license?: string;
  verification?: "verified" | "unverified";
  series: NavPackageSeries[];
}

export interface NavPackageResult {
  ok: boolean;
  error?: string;
  source?: string;
  retrievedDate?: string;
  seriesCount?: number;
  navPointCount?: number;
  matchedInstruments?: number;
  unmatchedSeries?: Array<{ isin?: string; scheme?: string; points: number }>;
  payload?: CommitImportPayload;
  duplicateFile?: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isValidPackage(obj: any): obj is NavPackage {
  if (!obj || typeof obj !== "object") return false;
  if (obj.format !== NAV_PACKAGE_FORMAT) return false;
  if (typeof obj.version !== "number") return false;
  if (typeof obj.source !== "string" || !obj.source.trim()) return false;
  if (typeof obj.retrievedDate !== "string" || !ISO.test(obj.retrievedDate)) return false;
  if (!Array.isArray(obj.series)) return false;
  return true;
}

/** Resolve a series to an existing instrument by ISIN first, then exact name. */
function matchInstrument(state: AppState, created: Instrument[], s: NavPackageSeries): Instrument | null {
  const all = [...state.instruments, ...created];
  if (s.isin) {
    const byIsin = all.find((i) => i.isin && i.isin.toUpperCase() === s.isin!.toUpperCase());
    if (byIsin) return byIsin;
  }
  if (s.scheme) {
    const byName = all.find((i) => i.name.toLowerCase() === s.scheme!.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

export async function parseNavPackage(file: File, state: AppState): Promise<NavPackageResult> {
  let obj: any;
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf.slice(0));
  const duplicateFile = state.importBatches.some((b) => b.fileHash === fileHash && b.status === "committed");
  try {
    obj = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  if (!isValidPackage(obj)) {
    return { ok: false, error: `Not a valid ${NAV_PACKAGE_FORMAT} v${NAV_PACKAGE_VERSION} file (needs format, version, source, retrievedDate, series[]).` };
  }
  if (obj.version > NAV_PACKAGE_VERSION) {
    return { ok: false, error: `This package is version ${obj.version}; this app understands up to v${NAV_PACKAGE_VERSION}.` };
  }

  const batchId = uid("batch");
  const payload: CommitImportPayload = {
    batch: {
      id: batchId,
      fileName: file.name,
      fileHash,
      sourceType: "nav_package",
      parserVersion: `navpkg-${NAV_PACKAGE_VERSION}`,
      committedAt: new Date().toISOString(),
      status: "committed",
      summary: "",
      addedTxnIds: [],
      addedSnapshotIds: [],
      addedAccountIds: [],
      addedInstrumentIds: [],
      period: undefined,
    },
    instruments: [],
    accounts: [],
    transactions: [],
    snapshots: [],
    prices: [],
    issues: [],
  };

  const createdInstruments: Instrument[] = [];
  const existingKey = new Set(state.prices.map((p) => `${p.instrumentId}|${p.date}|${p.quality}`));
  const seenKey = new Set<string>();
  let navPointCount = 0;
  let matchedInstruments = 0;
  const unmatched: Array<{ isin?: string; scheme?: string; points: number }> = [];

  for (const s of obj.series) {
    if (!s || !Array.isArray(s.navs)) continue;
    const validNavs = s.navs.filter((n: any) => n && ISO.test(n.date) && typeof n.nav === "number" && isFinite(n.nav) && n.nav > 0);
    if (validNavs.length === 0) continue;

    let inst = matchInstrument(state, createdInstruments, s);
    if (!inst) {
      // Create a reference-only instrument so the series can still be stored.
      if (!s.isin && !s.scheme) {
        continue;
      }
      inst = {
        id: uid("inst"),
        name: s.scheme ?? s.isin!,
        isin: s.isin,
        assetClass: "other_mf",
        plan: "unknown",
        option: "unknown",
      };
      createdInstruments.push(inst);
      payload.instruments.push(inst);
      unmatched.push({ isin: s.isin, scheme: s.scheme, points: validNavs.length });
    } else {
      matchedInstruments++;
    }

    for (const n of validNavs) {
      const key = `${inst.id}|${n.date}|package`;
      if (existingKey.has(key) || seenKey.has(key)) continue; // idempotent
      seenKey.add(key);
      const price: PriceObservation = {
        id: uid("price"),
        instrumentId: inst.id,
        date: n.date,
        price: n.nav,
        source: obj.source,
        quality: "package",
      };
      payload.prices.push(price);
      navPointCount++;
    }
  }

  payload.batch.summary = `${navPointCount} NAV point(s) from ${obj.series.length} series · source ${obj.source} · retrieved ${obj.retrievedDate}`;

  if (navPointCount === 0) {
    return {
      ok: false,
      error: "No new, valid NAV points were found (they may already be imported, or the series had no valid dated NAVs).",
      source: obj.source,
      retrievedDate: obj.retrievedDate,
      duplicateFile,
    };
  }

  return {
    ok: true,
    source: obj.source,
    retrievedDate: obj.retrievedDate,
    seriesCount: obj.series.length,
    navPointCount,
    matchedInstruments,
    unmatchedSeries: unmatched,
    payload,
    duplicateFile,
  };
}

/** A small, clearly-fictional sample package so users can see the format and flow. */
export function sampleNavPackageJson(): string {
  const pkg: NavPackage = {
    format: NAV_PACKAGE_FORMAT,
    version: NAV_PACKAGE_VERSION,
    source: "Sample offline NAV pack (fictional)",
    retrievedDate: "2026-10-08",
    license: "Illustrative sample — not real NAV data",
    verification: "unverified",
    series: [
      {
        isin: "INF000A01234",
        scheme: "Example Equity Fund Direct Growth",
        navs: [
          { date: "2026-07-08", nav: 120.5 },
          { date: "2026-08-08", nav: 124.1 },
          { date: "2026-09-08", nav: 127.9 },
          { date: "2026-10-08", nav: 131.4 },
        ],
      },
    ],
  };
  return JSON.stringify(pkg, null, 2);
}

export function downloadSampleNavPackage(): void {
  const blob = new Blob([sampleNavPackageJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-nav-package.iijnav.json";
  a.click();
  URL.revokeObjectURL(url);
}
