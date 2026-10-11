import React, { useMemo, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { Tabs, PageHead, Card, Button, Badge, Callout, NumberField, TextField, SelectField, EmptyState, Sheet } from "../components/ui";
import { StorageSetup } from "../components/StorageSetup";
import { currentHoldings, portfolioSummary, portfolioPerformance } from "../store/portfolio";
import { parseCsvFile, downloadTemplate, CsvTemplate, CsvPreview } from "../import/csv";
import { parseCasPdf, CasResult } from "../import/cas";
import { formatINR, formatINRCompact, formatPercent, groupIndian } from "../engine/money";
import { fmtDate, uid, todayISO } from "../util";
import { AssetClass, ManualAsset, ManualLiability } from "../types";

const CLASS_OPTIONS: Array<{ value: AssetClass; label: string }> = [
  { value: "equity_mf", label: "Equity fund" }, { value: "debt_mf", label: "Debt fund" }, { value: "hybrid_mf", label: "Hybrid fund" },
  { value: "cash", label: "Cash" }, { value: "fd_rd", label: "FD / RD" }, { value: "epf", label: "EPF" }, { value: "ppf", label: "PPF" },
  { value: "nps", label: "NPS" }, { value: "gold", label: "Gold" }, { value: "property", label: "Property" }, { value: "other", label: "Other" },
];

export function Portfolio() {
  const { state, dispatch, vaultStatus } = useApp();
  const [tab, setTab] = useState("holdings");
  const [showStorage, setShowStorage] = useState(false);

  const tabs = [
    { id: "holdings", label: "Holdings" },
    { id: "transactions", label: "Transactions" },
    { id: "performance", label: "Performance" },
    { id: "import", label: "Import" },
    { id: "manual", label: "Manual assets" },
  ];

  return (
    <div>
      <PageHead title="Portfolio">
        A reconciled view of what you own, with the valuation date and coverage shown for every number. We never ask for provider logins and never fetch data automatically.
      </PageHead>

      {vaultStatus === "none" && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn">
            No storage is set up, so imports won't survive a page reload. <Button size="sm" onClick={() => setShowStorage(true)}>Set up storage</Button>
          </Callout>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "holdings" && <HoldingsTab />}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "performance" && <PerformanceTab />}
      {tab === "import" && <ImportTab onNeedStorage={() => setShowStorage(true)} />}
      {tab === "manual" && <ManualTab />}

      {showStorage && <StorageSetup onClose={() => setShowStorage(false)} reason="Set up a local vault so your imported portfolio and goals are saved on this device." />}
    </div>
  );
}

function HoldingsTab() {
  const { state } = useApp();
  const [filter, setFilter] = useState<AssetClass | "all">("all");
  const holdings = currentHoldings(state);
  const instById = new Map(state.instruments.map((i) => [i.id, i]));
  const acctById = new Map(state.accounts.map((a) => [a.id, a]));
  const summary = portfolioSummary(state);

  const filtered = holdings.filter((h) => filter === "all" || instById.get(h.instrumentId)?.assetClass === filter);

  if (holdings.length === 0 && state.manualAssets.length === 0) {
    return <EmptyState icon="▤" title="No holdings yet">Import a statement or CSV, or add assets manually.</EmptyState>;
  }

  return (
    <div className="stack">
      <Card>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Current holdings</h3>
          <div style={{ minWidth: 180 }}>
            <SelectField<AssetClass | "all"> label="" value={filter} onChange={setFilter} options={[{ value: "all", label: "All asset classes" }, ...CLASS_OPTIONS]} />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Instrument</th><th>Account</th><th className="num">Units</th><th className="num">Value</th><th>Valuation basis</th></tr></thead>
            <tbody>
              {filtered.map((h, i) => {
                const inst = instById.get(h.instrumentId);
                const acct = acctById.get(h.accountId);
                return (
                  <tr key={i}>
                    <td>{inst?.name ?? "—"} {inst?.plan && inst.plan !== "unknown" && <Badge tone="neutral">{inst.plan}</Badge>}</td>
                    <td className="soft">{acct?.provider} {acct?.maskedNumber}</td>
                    <td className="num">{h.units ? groupIndian(h.units, 3) : "—"}</td>
                    <td className="num">{h.value == null ? <Badge tone="amber">Unpriced</Badge> : formatINR(h.value)}</td>
                    <td className="soft">{h.valuationBasis}{h.valuationDate ? ` · ${fmtDate(h.valuationDate)}` : ""} {h.priceStale && <Badge tone="amber">stale</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {summary.unvaluedCount > 0 && <div style={{ marginTop: 12 }}><Callout tone="warn">{summary.coverageNote} Unpriced positions stay visible but are excluded from the valued total.</Callout></div>}
      </Card>
    </div>
  );
}

function TransactionsTab() {
  const { state } = useApp();
  const instById = new Map(state.instruments.map((i) => [i.id, i]));
  const txns = [...state.transactions].filter((t) => !t.reversed).sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));
  if (txns.length === 0) return <EmptyState icon="≋" title="No transactions">Import a detailed statement to see your transaction ledger here.</EmptyState>;
  return (
    <Card>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th>Date</th><th>Instrument</th><th>Type</th><th className="num">Units</th><th className="num">Amount</th><th>Source</th></tr></thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.eventDate)}</td>
                <td>{instById.get(t.instrumentId)?.name ?? "—"}</td>
                <td><Badge tone={t.type === "unknown" ? "amber" : "neutral"}>{t.type}</Badge></td>
                <td className="num">{t.unitsDelta ? groupIndian(t.unitsDelta, 3) : "—"}</td>
                <td className="num">{t.grossAmount != null ? formatINR(t.grossAmount) : "—"}</td>
                <td className="soft" style={{ fontSize: "0.78rem" }}>{t.provenance}{t.confidence && t.confidence !== "high" ? ` · ${t.confidence}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PerformanceTab() {
  const { state } = useApp();
  const perf = portfolioPerformance(state);
  return (
    <Card>
      <h3>Performance</h3>
      {!perf.available ? (
        <Callout tone="info">{perf.reason}</Callout>
      ) : perf.xirr?.status === "ok" ? (
        <>
          <div className="grid cols-3" style={{ marginTop: 8 }}>
            <div><div className="stat-label">XIRR (annualised)</div><div className="stat-value">{formatPercent(perf.xirr.rate!)}</div></div>
            <div><div className="stat-label">Invested (net)</div><div className="stat-value" style={{ fontSize: "1.3rem" }}>{formatINRCompact(perf.invested!)}</div></div>
            <div><div className="stat-label">Current value</div><div className="stat-value" style={{ fontSize: "1.3rem" }}>{formatINRCompact(perf.currentValue!)}</div></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <h4>Value bridge</h4>
            <table className="data">
              <tbody>
                <tr><td>Net invested cash</td><td className="num">{formatINR(perf.invested!)}</td></tr>
                <tr><td>Investment gain</td><td className="num">{formatINR(perf.periodGain!)}</td></tr>
                <tr><td><strong>Current value</strong></td><td className="num"><strong>{formatINR(perf.currentValue!)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          {perf.note && <div style={{ marginTop: 12 }}><Callout tone="warn">{perf.note}</Callout></div>}
          <div style={{ marginTop: 12 }}><Callout tone="info">XIRR is a cash-flow return and is not directly comparable to an index CAGR. Benchmarks on an aligned basis arrive in a later release.</Callout></div>
        </>
      ) : (
        <Callout tone="warn">{perf.xirr?.message}</Callout>
      )}
    </Card>
  );
}

function ImportTab({ onNeedStorage }: { onNeedStorage: () => void }) {
  const { state, dispatch, vaultStatus } = useApp();
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [casResult, setCasResult] = useState<CasResult | null>(null);
  const [casPassword, setCasPassword] = useState("");
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<CsvTemplate>("transactions");

  async function onCsv(file: File) {
    setBusy(true);
    try {
      const preview = await parseCsvFile(file, template, state);
      setCsvPreview(preview);
    } finally { setBusy(false); }
  }

  function commitCsv() {
    if (!csvPreview) return;
    dispatch({ type: "COMMIT_IMPORT", payload: csvPreview.payload });
    const manual = (csvPreview.payload as any).manualAssets as ManualAsset[] | undefined;
    if (manual) manual.forEach((a) => dispatch({ type: "ADD_MANUAL_ASSET", asset: a }));
    setCsvPreview(null);
    if (vaultStatus === "none") onNeedStorage();
  }

  async function onPdf(file: File) {
    setPendingPdf(file);
    setBusy(true);
    try {
      const res = await parseCasPdf(file, casPassword || undefined, state);
      setCasResult(res);
    } finally { setBusy(false); }
  }

  function commitCas() {
    if (casResult?.payload) {
      dispatch({ type: "COMMIT_IMPORT", payload: casResult.payload });
      setCasResult(null);
      setPendingPdf(null);
      setCasPassword("");
      if (vaultStatus === "none") onNeedStorage();
    }
  }

  function loadSample() {
    const payload = buildSamplePayload();
    dispatch({ type: "COMMIT_IMPORT", payload: payload.commit });
    payload.manualAssets.forEach((a) => dispatch({ type: "ADD_MANUAL_ASSET", asset: a }));
    payload.liabilities.forEach((l) => dispatch({ type: "ADD_MANUAL_LIABILITY", liability: l }));
    if (vaultStatus === "none") onNeedStorage();
  }

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <Card>
        <h3>Generic CSV</h3>
        <p className="soft">Download a template, fill it in from any provider's export, and import. Dates, decimals and signs are validated and previewed.</p>
        <SelectField<CsvTemplate> label="Template" value={template} onChange={setTemplate}
          options={[{ value: "transactions", label: "Transactions" }, { value: "holdings", label: "Holdings snapshot" }, { value: "prices", label: "Prices / NAV" }, { value: "manual_assets", label: "Manual assets" }]} />
        <div className="row">
          <Button size="sm" onClick={() => downloadTemplate(template)}>Download template</Button>
          <Button size="sm" variant="primary" onClick={() => csvInput.current?.click()} disabled={busy}>Choose CSV file</Button>
          <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} />
        </div>

        <hr className="hr" />
        <h3>CAMS / KFintech CAS (PDF)</h3>
        <Badge tone="amber">Best-effort beta</Badge>
        <p className="soft" style={{ marginTop: 8 }}>Decrypted locally with your password. Scanned/image PDFs and unrecognised layouts are rejected rather than guessed.</p>
        <TextField label="PDF password (if any)" type="password" value={casPassword} onChange={setCasPassword} />
        <Button size="sm" onClick={() => document.getElementById("pdf-input")?.click()} disabled={busy}>Choose PDF file</Button>
        <input id="pdf-input" type="file" accept="application/pdf,.pdf" hidden onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0])} />

        <hr className="hr" />
        <h3>Explore with sample data</h3>
        <p className="soft">Load a clearly fictional portfolio to see every screen populated.</p>
        <Button size="sm" variant="teal" onClick={loadSample}>Load sample portfolio</Button>
      </Card>

      <div className="stack">
        {busy && <Card><p className="soft" style={{ margin: 0 }}>Reading your file locally…</p></Card>}

        {csvPreview && (
          <Card>
            <h3>Import preview — {csvPreview.fileName}</h3>
            {csvPreview.duplicateFile && <Callout tone="warn">This exact file was already imported; committing again will add duplicate entries. Importing the same file normally changes nothing.</Callout>}
            <p className="soft">{csvPreview.accepted} of {csvPreview.rowCount} row(s) accepted · {csvPreview.issues.length} issue(s).</p>
            {csvPreview.issues.slice(0, 6).map((iss) => (
              <div key={iss.id} style={{ marginBottom: 6 }}><Badge tone={iss.severity === "blocking" ? "red" : "amber"}>{iss.severity}</Badge> <span className="soft">{iss.message}</span></div>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="primary" size="sm" onClick={commitCsv} disabled={csvPreview.accepted === 0}>Commit import</Button>
              <Button variant="ghost" size="sm" onClick={() => setCsvPreview(null)}>Cancel</Button>
            </div>
          </Card>
        )}

        {casResult && (
          <Card>
            <h3>CAS import — {casResult.fileName}</h3>
            {casResult.outcome === "parsed" ? (
              <>
                <Callout tone="warn">{casResult.message}</Callout>
                <p className="soft">{casResult.foliosDetected} folio(s), {casResult.txnDetected} transaction(s) detected. Review carefully before committing — this is a beta parser.</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <Button variant="primary" size="sm" onClick={commitCas}>Commit after review</Button>
                  <Button variant="ghost" size="sm" onClick={() => setCasResult(null)}>Discard</Button>
                </div>
              </>
            ) : casResult.outcome === "wrong-password" ? (
              <Callout tone="error">{casResult.message} Enter the password above and choose the file again.</Callout>
            ) : (
              <Callout tone={casResult.outcome === "scanned" ? "warn" : "error"}>{casResult.message}</Callout>
            )}
          </Card>
        )}

        {!csvPreview && !casResult && !busy && (
          <Card><EmptyState icon="⇪" title="Nothing staged">Choose a file to see a full preview before anything is committed.</EmptyState></Card>
        )}
      </div>
    </div>
  );
}

function ManualTab() {
  const { state, dispatch } = useApp();
  const [showAsset, setShowAsset] = useState(false);
  const [showLiab, setShowLiab] = useState(false);
  return (
    <div className="stack">
      <Card>
        <div className="row between"><h3 style={{ margin: 0 }}>Manual assets</h3><Button size="sm" onClick={() => setShowAsset(true)}>+ Add asset</Button></div>
        {state.manualAssets.length === 0 ? <p className="soft">Cash, FD/RD, EPF, PPF, NPS, gold, property and other investments. Each needs a value date and basis.</p> : (
          <table className="data">
            <thead><tr><th>Asset</th><th>Class</th><th className="num">Value</th><th>As of</th><th></th></tr></thead>
            <tbody>
              {state.manualAssets.map((a) => (
                <tr key={a.id}>
                  <td>{a.label} {!a.liquid && <Badge tone="neutral">locked</Badge>}</td>
                  <td className="soft">{a.assetClass}</td>
                  <td className="num">{formatINR(a.value)}</td>
                  <td className="soft">{fmtDate(a.valuationDate)} · {a.valuationBasis}</td>
                  <td className="num"><Button variant="ghost" size="sm" onClick={() => dispatch({ type: "REMOVE_MANUAL_ASSET", id: a.id })}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="row between"><h3 style={{ margin: 0 }}>Liabilities</h3><Button size="sm" onClick={() => setShowLiab(true)}>+ Add liability</Button></div>
        {state.manualLiabilities.length === 0 ? <p className="soft">Loans and other debts. Recorded separately from assets.</p> : (
          <table className="data">
            <thead><tr><th>Liability</th><th className="num">Balance</th><th>As of</th><th></th></tr></thead>
            <tbody>
              {state.manualLiabilities.map((l) => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td className="num">{formatINR(l.balance)}</td>
                  <td className="soft">{fmtDate(l.valuationDate)}</td>
                  <td className="num"><Button variant="ghost" size="sm" onClick={() => dispatch({ type: "REMOVE_MANUAL_LIABILITY", id: l.id })}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAsset && <AddAssetSheet onClose={() => setShowAsset(false)} />}
      {showLiab && <AddLiabilitySheet onClose={() => setShowLiab(false)} />}
    </div>
  );
}

function AddAssetSheet({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp();
  const [label, setLabel] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("cash");
  const [value, setValue] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [basis, setBasis] = useState("self-reported");
  const [liquid, setLiquid] = useState(true);
  return (
    <Sheet title="Add manual asset" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!label || value <= 0} onClick={() => {
          dispatch({ type: "ADD_MANUAL_ASSET", asset: { id: uid("masset"), ownerId: "owner_self", label, assetClass, value, valuationDate: date, valuationBasis: basis, liquid } });
          onClose();
        }}>Add asset</Button>
      </>
    }>
      <TextField label="Label" value={label} onChange={setLabel} placeholder="e.g. EPF balance" />
      <SelectField<AssetClass> label="Asset class" value={assetClass} onChange={setAssetClass} options={CLASS_OPTIONS} />
      <NumberField label="Value" prefix="₹" value={value} onChange={setValue} min={0} />
      <label className="field"><span className="field-label">Valuation date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <TextField label="Valuation basis" value={basis} onChange={setBasis} hint="e.g. passbook, bank statement" />
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={liquid} onChange={(e) => setLiquid(e.target.checked)} style={{ width: "auto" }} /> <span className="soft">Liquid / accessible</span></label>
    </Sheet>
  );
}

function AddLiabilitySheet({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp();
  const [label, setLabel] = useState("");
  const [balance, setBalance] = useState(0);
  const [date, setDate] = useState(todayISO());
  return (
    <Sheet title="Add liability" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!label || balance <= 0} onClick={() => {
          dispatch({ type: "ADD_MANUAL_LIABILITY", liability: { id: uid("liab"), ownerId: "owner_self", label, balance, valuationDate: date } });
          onClose();
        }}>Add liability</Button>
      </>
    }>
      <TextField label="Label" value={label} onChange={setLabel} placeholder="e.g. Home loan" />
      <NumberField label="Outstanding balance" prefix="₹" value={balance} onChange={setBalance} min={0} />
      <label className="field"><span className="field-label">As of date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    </Sheet>
  );
}

// ---- Fictional sample portfolio ----
function buildSamplePayload() {
  const acctId = uid("acct");
  const instId = uid("inst");
  const inst2 = uid("inst");
  const batchId = uid("batch");
  const today = todayISO();
  const commit = {
    batch: {
      id: batchId, fileName: "Sample portfolio (fictional)", fileHash: "sample-" + batchId, sourceType: "sample",
      parserVersion: "sample-1.0.0", committedAt: new Date().toISOString(), status: "committed" as const,
      summary: "Fictional sample data for exploration.", addedTxnIds: [] as string[], addedSnapshotIds: [] as string[],
      addedAccountIds: [acctId], addedInstrumentIds: [instId, inst2],
    },
    instruments: [
      { id: instId, name: "Sample Equity Fund — Direct Growth", isin: "INF000SAMPLE1", assetClass: "equity_mf" as AssetClass, plan: "direct" as const, option: "growth" as const, fundHouse: "Sample AMC" },
      { id: inst2, name: "Sample Short-Duration Debt — Direct Growth", isin: "INF000SAMPLE2", assetClass: "debt_mf" as AssetClass, plan: "direct" as const, option: "growth" as const, fundHouse: "Sample AMC" },
    ],
    accounts: [{ id: acctId, ownerId: "owner_self", provider: "Sample (CAMS)", maskedNumber: "••••1234" }],
    transactions: [] as any[],
    snapshots: [] as any[],
    prices: [
      { id: uid("price"), instrumentId: instId, date: today, price: 128.5, source: "sample", quality: "manual" as const },
      { id: uid("price"), instrumentId: inst2, date: today, price: 41.2, source: "sample", quality: "manual" as const },
    ],
    issues: [] as any[],
  };
  // 24 monthly SIPs into the equity fund.
  let navEq = 95;
  for (let m = 0; m < 24; m++) {
    const d = new Date(); d.setMonth(d.getMonth() - (24 - m)); const iso = d.toISOString().slice(0, 10);
    navEq *= 1 + (Math.sin(m) * 0.03 + 0.01);
    const units = 10000 / navEq;
    const tid = uid("txn");
    commit.transactions.push({ id: tid, accountId: acctId, instrumentId: instId, eventDate: iso, type: "sip", unitsDelta: units, grossAmount: 10000, netAmount: 10000, nav: Number(navEq.toFixed(4)), investorCashFlow: -10000, provenance: "sample", confidence: "high", importBatchId: batchId });
    commit.batch.addedTxnIds.push(tid);
  }
  // A debt-fund holding snapshot (holdings-only, so it demonstrates "returns need history").
  const sid = uid("snap");
  commit.snapshots.push({ id: sid, accountId: acctId, instrumentId: inst2, units: 7200, value: 296640, nav: 41.2, valuationDate: today, source: "sample", confidence: "high" });
  commit.batch.addedSnapshotIds.push(sid);

  const manualAssets: ManualAsset[] = [
    { id: uid("masset"), ownerId: "owner_self", label: "EPF balance", assetClass: "epf", value: 540000, valuationDate: "2026-03-31", valuationBasis: "passbook", liquid: false },
    { id: uid("masset"), ownerId: "owner_self", label: "Emergency savings", assetClass: "cash", value: 250000, valuationDate: today, valuationBasis: "bank statement", liquid: true },
  ];
  const liabilities: ManualLiability[] = [
    { id: uid("liab"), ownerId: "owner_self", label: "Car loan", balance: 320000, valuationDate: today },
  ];
  return { commit, manualAssets, liabilities };
}
