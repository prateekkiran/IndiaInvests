import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, TextField, SliderField, Toggle, Sheet } from "../components/ui";
import { StorageSetup } from "../components/StorageSetup";
import { formatPercent } from "../engine/money";
import { fiscalYearLabel, todayISO } from "../util";

export function Settings() {
  const { state, dispatch, vaultStatus, encrypted, lock, createEncryptedVault } = useApp();
  const [showStorage, setShowStorage] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const prefs = state.preferences;

  async function changePass() {
    if (p1.length < 8) { setErr("Use at least 8 characters."); return; }
    if (p1 !== p2) { setErr("Passphrases don't match."); return; }
    await createEncryptedVault(p1);
    setShowChange(false); setP1(""); setP2(""); setErr(null); setMsg("Passphrase updated.");
  }

  return (
    <div>
      <PageHead title="Settings" />

      {msg && <div style={{ marginBottom: 12 }}><Callout tone="success">{msg}</Callout></div>}

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <h3>Profile</h3>
          <TextField label="Your display name" value={state.owners[0]?.label ?? ""} onChange={(v) => dispatch({ type: "REPLACE_STATE", state: { ...state, owners: [{ ...state.owners[0], label: v }, ...state.owners.slice(1)] } })} hint="Labels only — never full PAN/Aadhaar/bank numbers" />
          <div className="soft" style={{ fontSize: "0.84rem" }}>Currency: <strong>INR (₹)</strong> · Dates: <strong>11 Oct 2026</strong> · Financial year: <strong>{fiscalYearLabel(todayISO())}</strong> (1 Apr – 31 Mar)</div>
        </Card>

        <Card>
          <h3>Default assumptions</h3>
          <p className="soft">Starter values for new calculators and goals. Illustrative only — never inferred from any fund's past performance.</p>
          <SliderField label="Default assumed return" value={prefs.defaultAnnualReturn} min={0} max={0.18} step={0.005} onChange={(v) => dispatch({ type: "SET_PREFERENCES", patch: { defaultAnnualReturn: v } })} format={(v) => formatPercent(v)} />
          <SliderField label="Default inflation" value={prefs.defaultInflation} min={0} max={0.12} step={0.005} onChange={(v) => dispatch({ type: "SET_PREFERENCES", patch: { defaultInflation: v } })} format={(v) => formatPercent(v)} />
          <Toggle label="Privacy mode — mask balances on screen" checked={prefs.privacyMaskBalances} onChange={(v) => dispatch({ type: "SET_PREFERENCES", patch: { privacyMaskBalances: v } })} />
        </Card>

        <Card>
          <h3>Storage & vault</h3>
          <div className="row">
            <Badge tone={vaultStatus === "unlocked" ? "green" : "neutral"}>{vaultStatus === "none" ? "No vault" : vaultStatus}</Badge>
            <Badge tone={encrypted ? "teal" : "amber"}>{encrypted ? "Encrypted" : "Unencrypted"}</Badge>
          </div>
          <p className="soft" style={{ marginTop: 10 }}>Data is stored only on this device. A forgotten passphrase cannot be recovered — keep an encrypted backup (Data centre).</p>
          <div className="row">
            {vaultStatus === "none" && <Button size="sm" variant="primary" onClick={() => setShowStorage(true)}>Set up storage</Button>}
            {vaultStatus === "unlocked" && encrypted && <Button size="sm" onClick={() => setShowChange(true)}>Change passphrase</Button>}
            {vaultStatus === "unlocked" && !encrypted && <Button size="sm" variant="primary" onClick={() => setShowChange(true)}>Add encryption</Button>}
            {vaultStatus === "unlocked" && encrypted && <Button size="sm" variant="ghost" onClick={lock}>Lock now</Button>}
          </div>
        </Card>

        <Card>
          <h3>About & boundaries</h3>
          <p className="soft" style={{ fontSize: "0.85rem" }}>
            This is an educational planning tool. It does not execute orders, collect money, initiate SIP mandates, promise returns, file taxes, or recommend specific funds to buy or sell. Projections are illustrations using your assumptions and are explicitly pre-tax.
          </p>
          <p className="soft" style={{ fontSize: "0.85rem" }}>
            No market data is fetched automatically; valuations come from your statements and any prices you enter. Benchmarks, retirement drawdown and depository/broker adapters are planned for later releases.
          </p>
          <Badge tone="neutral">Engine {state.engineVersion}</Badge>
          <p className="soft" style={{ fontSize: "0.85rem", marginTop: 10 }}>
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">Privacy policy</a> — your data stays on this device.
          </p>
        </Card>
      </div>

      {showStorage && <StorageSetup onClose={() => setShowStorage(false)} />}

      {showChange && (
        <Sheet title={encrypted ? "Change passphrase" : "Add encryption"} onClose={() => setShowChange(false)} footer={<><Button variant="ghost" onClick={() => setShowChange(false)}>Cancel</Button><Button variant="primary" onClick={changePass}>Save</Button></>}>
          <p className="soft">Your data is re-encrypted immediately with the new passphrase.</p>
          <TextField label="New passphrase" type="password" value={p1} onChange={setP1} />
          <TextField label="Confirm passphrase" type="password" value={p2} onChange={setP2} />
          {err && <Callout tone="error">{err}</Callout>}
        </Sheet>
      )}
    </div>
  );
}
