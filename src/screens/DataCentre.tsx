import React, { useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, EmptyState, Sheet, TextField } from "../components/ui";
import { portfolioSummary } from "../store/portfolio";
import { formatINR } from "../engine/money";
import { fmtDate } from "../util";
import { CountUp, Reveal } from "../anim/components";
import { openPlanReport } from "../report/planReport";

export function DataCentre() {
  const { state, dispatch, encrypted, exportBackup, importBackup, markBackupNow, wipe } = useApp();
  const summary = portfolioSummary(state);
  const [backupPass, setBackupPass] = useState("");
  const [showBackup, setShowBackup] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restorePass, setRestorePass] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);

  async function doBackup() {
    try {
      const blob = await exportBackup(backupPass);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `iij-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      markBackupNow();
      setShowBackup(false); setBackupPass(""); setMsg("Encrypted backup downloaded.");
    } catch (e) { setErr((e as Error).message); }
  }

  async function doRestore() {
    if (!restoreFile) return;
    try {
      await importBackup(restoreFile, restorePass);
      setShowRestore(false); setRestoreFile(null); setRestorePass(""); setMsg("Backup restored and validated.");
    } catch (e) { setErr((e as Error).message); }
  }

  function exportLedgerCsv() {
    const instById = new Map(state.instruments.map((i) => [i.id, i]));
    const header = "date,instrument,isin,type,units,amount,nav,source,confidence\n";
    const rows = state.transactions.filter((t) => !t.reversed).map((t) => {
      const inst = instById.get(t.instrumentId);
      const cell = (v: any) => { const s = String(v ?? ""); return /^[=+\-@]/.test(s) ? "'" + s : s; }; // neutralise formula injection
      return [t.eventDate, cell(inst?.name ?? ""), inst?.isin ?? "", t.type, t.unitsDelta ?? "", t.grossAmount ?? "", t.nav ?? "", cell(t.provenance ?? ""), t.confidence ?? ""]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
    }).join("\n");
    const banner = `# India Investment Journey ledger export · generated ${new Date().toISOString()}\n# Excluded (reversed) rows omitted. Values carry their source dates.\n`;
    const blob = new Blob([banner + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "iij-ledger.csv"; a.click();
    URL.revokeObjectURL(url);
    setMsg("CSV ledger exported.");
  }

  function openReport() {
    const ok = openPlanReport(state);
    if (!ok) setErr("Your browser blocked the report window. Allow pop-ups for this site, then try again.");
    else setMsg("Plan report opened in a new tab — use its “Save as PDF / Print” button.");
  }

  return (
    <div>
      <PageHead title="Data centre">
        Your import history, backups and data controls. Every export carries valuation dates, excluded accounts and any missing-data warnings.
      </PageHead>

      {msg && <div style={{ marginBottom: 12 }}><Callout tone="success">{msg}</Callout></div>}
      {err && <div style={{ marginBottom: 12 }}><Callout tone="error">{err}</Callout></div>}

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <h3>Backups</h3>
          <p className="soft">Browser storage can be cleared or evicted. Keep an encrypted backup after material imports.</p>
          <div className="row">
            <Badge tone={state.lastBackupAt ? "green" : "amber"}>{state.lastBackupAt ? `Last backup ${fmtDate(state.lastBackupAt)}` : "No backup yet"}</Badge>
            <Badge tone={encrypted ? "teal" : "amber"}>{encrypted ? "Vault encrypted" : "Vault unencrypted"}</Badge>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Button size="sm" variant="primary" onClick={() => setShowBackup(true)}>Export encrypted backup</Button>
            <Button size="sm" onClick={() => setShowRestore(true)}>Restore from backup</Button>
          </div>
          <hr className="hr" />
          <h3>Reports</h3>
          <div className="row">
            <Button size="sm" onClick={exportLedgerCsv}>Export CSV ledger</Button>
            <Button size="sm" variant="primary" onClick={openReport}>Export plan PDF</Button>
          </div>
        </Card>

        <Card>
          <h3>Coverage</h3>
          <table className="data">
            <tbody>
              <tr><td>Valued holdings</td><td className="num"><CountUp value={summary.valuedCount} duration={800} format={(v) => String(Math.round(v))} /></td></tr>
              <tr><td>Unpriced holdings</td><td className="num">{summary.unvaluedCount}</td></tr>
              <tr><td>Valued total</td><td className="num"><CountUp value={summary.valuedTotal} format={formatINR} /></td></tr>
              <tr><td>Valuation dates</td><td className="num">{summary.valuationDateMin ? `${fmtDate(summary.valuationDateMin)} – ${fmtDate(summary.valuationDateMax)}` : "—"}</td></tr>
              <tr><td>Open issues</td><td className="num">{state.issues.filter((i) => !i.resolved).length}</td></tr>
            </tbody>
          </table>
          {summary.anyStale && <div style={{ marginTop: 10 }}><Callout tone="warn">Some prices are stale (older than 5 business days).</Callout></div>}
        </Card>
      </div>

      <Reveal delay={80}><Card style={{ marginTop: 16 }}>
        <h3>Import history</h3>
        {state.importBatches.length === 0 ? (
          <EmptyState icon="⛁" title="No imports yet">Imported batches appear here with their parser version and can be rolled back.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>File</th><th>Source</th><th>Parser</th><th>Committed</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {state.importBatches.slice().reverse().map((b) => (
                  <tr key={b.id}>
                    <td>{b.fileName}</td>
                    <td className="soft">{b.sourceType}</td>
                    <td className="soft">{b.parserVersion}</td>
                    <td className="soft">{fmtDate(b.committedAt.slice(0, 10))}</td>
                    <td>{b.status === "committed" ? <Badge tone="green">committed</Badge> : <Badge tone="neutral">reversed</Badge>}</td>
                    <td className="num">{b.status === "committed" && <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REVERSE_IMPORT", batchId: b.id })}>Roll back</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card></Reveal>

      <Card style={{ marginTop: 16, borderColor: "var(--red-100)" }}>
        <h3 style={{ color: "var(--red-600)" }}>Delete everything</h3>
        <p className="soft">Removes the local vault and all data on this device. This cannot be undone. Export a backup first if you might need the data.</p>
        {!confirmWipe ? <Button variant="danger" size="sm" onClick={() => setConfirmWipe(true)}>Delete all data…</Button> : (
          <div className="row"><Button variant="danger" size="sm" onClick={() => wipe()}>Yes, delete everything</Button><Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>Cancel</Button></div>
        )}
      </Card>

      {showBackup && (
        <Sheet title="Export encrypted backup" onClose={() => setShowBackup(false)} footer={<><Button variant="ghost" onClick={() => setShowBackup(false)}>Cancel</Button><Button variant="primary" disabled={backupPass.length < 8} onClick={doBackup}>Download</Button></>}>
          <p className="soft">Choose a passphrase (min 8 chars) to encrypt this backup file. You'll need it to restore.</p>
          <TextField label="Backup passphrase" type="password" value={backupPass} onChange={setBackupPass} />
        </Sheet>
      )}

      {showRestore && (
        <Sheet title="Restore from backup" onClose={() => setShowRestore(false)} footer={<><Button variant="ghost" onClick={() => setShowRestore(false)}>Cancel</Button><Button variant="primary" disabled={!restoreFile || !restorePass} onClick={doRestore}>Restore</Button></>}>
          <Callout tone="warn">Restoring replaces the data currently in memory. The schema is validated before anything is applied.</Callout>
          <div style={{ margin: "12px 0" }}>
            <Button size="sm" onClick={() => restoreInput.current?.click()}>{restoreFile ? restoreFile.name : "Choose backup file"}</Button>
            <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
          </div>
          <TextField label="Backup passphrase" type="password" value={restorePass} onChange={setRestorePass} />
        </Sheet>
      )}
    </div>
  );
}
