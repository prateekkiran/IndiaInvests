import { describe, it, expect } from "vitest";
import { detectBroker, BROKER_ADAPTERS } from "./brokers";
import { parseNavPackage, sampleNavPackageJson, NAV_PACKAGE_FORMAT } from "./navpackage";
import { valueHistory } from "../store/portfolio";
import { emptyState } from "../store/state";
import { AppState } from "../types";

// Minimal File shim for the vitest/jsdom environment.
function jsonFile(obj: unknown, name = "pkg.iijnav.json"): File {
  return new File([JSON.stringify(obj)], name, { type: "application/json" });
}

describe("broker CSV detection", () => {
  it("detects Zerodha Coin from its header tokens", () => {
    const d = detectBroker(["trade_date", "tradingsymbol", "isin", "trade_type", "quantity", "amount", "price"]);
    expect(d.adapter?.id).toBe("zerodha_coin");
    expect(d.score).toBeGreaterThanOrEqual(0.75);
  });

  it("detects Groww from its header tokens", () => {
    const d = detectBroker(["Scheme Name", "Transaction Type", "Units", "NAV", "Amount", "Transaction Date"]);
    expect(d.adapter?.id).toBe("groww");
  });

  it("returns no adapter for an unrelated header set", () => {
    const d = detectBroker(["foo", "bar", "baz"]);
    expect(d.adapter).toBeNull();
  });

  it("every adapter has a non-empty signature and aliases", () => {
    for (const a of BROKER_ADAPTERS) {
      expect(a.signature.length).toBeGreaterThanOrEqual(1);
      expect(Object.keys(a.aliases).length).toBeGreaterThan(0);
    }
  });
});

describe("NAV-history package import", () => {
  const base: AppState = {
    ...emptyState(),
    instruments: [
      { id: "inst_eq", name: "Example Equity Fund Direct Growth", isin: "INF000A01234", assetClass: "equity_mf", plan: "direct", option: "growth" },
    ],
  };

  it("rejects non-JSON", async () => {
    const f = new File(["not json {{"], "x.json", { type: "application/json" });
    const r = await parseNavPackage(f, base);
    expect(r.ok).toBe(false);
  });

  it("rejects a wrong-format object", async () => {
    const r = await parseNavPackage(jsonFile({ format: "something-else", version: 1, source: "x", retrievedDate: "2026-10-08", series: [] }), base);
    expect(r.ok).toBe(false);
  });

  it("imports the sample package and matches the existing instrument by ISIN", async () => {
    const f = new File([sampleNavPackageJson()], "sample.iijnav.json", { type: "application/json" });
    const r = await parseNavPackage(f, base);
    expect(r.ok).toBe(true);
    expect(r.source).toContain("Sample");
    expect(r.navPointCount).toBe(4);
    expect(r.matchedInstruments).toBe(1);
    // All prices should be package-quality and attached to the existing instrument.
    expect(r.payload!.prices.every((p) => p.quality === "package")).toBe(true);
    expect(r.payload!.prices.every((p) => p.instrumentId === "inst_eq")).toBe(true);
    // No new instrument created since the ISIN matched.
    expect(r.payload!.instruments.length).toBe(0);
  });

  it("is idempotent — re-importing the same NAV points adds nothing new", async () => {
    const first = await parseNavPackage(new File([sampleNavPackageJson()], "a.json"), base);
    const withPrices: AppState = { ...base, prices: first.payload!.prices };
    const second = await parseNavPackage(new File([sampleNavPackageJson()], "b.json"), withPrices);
    expect(second.ok).toBe(false); // nothing new
  });

  it("creates a reference instrument for an unmatched series", async () => {
    const pkg = {
      format: NAV_PACKAGE_FORMAT,
      version: 1,
      source: "Test",
      retrievedDate: "2026-10-08",
      series: [{ isin: "INF999Z99999", scheme: "Unknown Fund", navs: [{ date: "2026-10-01", nav: 10 }] }],
    };
    const r = await parseNavPackage(jsonFile(pkg), base);
    expect(r.ok).toBe(true);
    expect(r.payload!.instruments.length).toBe(1);
    expect(r.unmatchedSeries?.length).toBe(1);
  });
});

describe("observed value history (POR03)", () => {
  it("plots complete points only where every held instrument has a NAV", () => {
    const s: AppState = {
      ...emptyState(),
      instruments: [
        { id: "A", name: "A", isin: "INFA", assetClass: "equity_mf", plan: "direct", option: "growth" },
        { id: "B", name: "B", isin: "INFB", assetClass: "debt_mf", plan: "direct", option: "growth" },
      ],
      accounts: [{ id: "ac", ownerId: "owner_self", provider: "X", maskedNumber: "••1" }],
      transactions: [
        { id: "t1", accountId: "ac", instrumentId: "A", eventDate: "2026-01-01", type: "purchase", unitsDelta: 100 },
        { id: "t2", accountId: "ac", instrumentId: "B", eventDate: "2026-02-01", type: "purchase", unitsDelta: 50 },
      ],
      prices: [
        { id: "p1", instrumentId: "A", date: "2026-01-31", price: 10, source: "pkg", quality: "package" },
        { id: "p2", instrumentId: "A", date: "2026-02-28", price: 11, source: "pkg", quality: "package" },
        { id: "p3", instrumentId: "B", date: "2026-02-28", price: 20, source: "pkg", quality: "package" },
      ],
    };
    const vh = valueHistory(s);
    // 2026-01-31: only A held+priced -> complete (B not yet held).
    // 2026-02-28: A and B both held and priced -> complete, value = 100*11 + 50*20 = 2100.
    const feb = vh.completePoints.find((p) => p.date === "2026-02-28");
    expect(feb?.value).toBe(2100);
    expect(vh.completePoints.length).toBe(2);
  });

  it("returns a helpful note when there are no dated NAVs", () => {
    const s: AppState = {
      ...emptyState(),
      accounts: [{ id: "ac", ownerId: "owner_self", provider: "X", maskedNumber: "••1" }],
      instruments: [{ id: "A", name: "A", assetClass: "equity_mf", plan: "direct", option: "growth" }],
      transactions: [{ id: "t1", accountId: "ac", instrumentId: "A", eventDate: "2026-01-01", type: "purchase", unitsDelta: 100 }],
    };
    const vh = valueHistory(s);
    expect(vh.completePoints.length).toBe(0);
    expect(vh.note.toLowerCase()).toContain("nav");
  });
});
