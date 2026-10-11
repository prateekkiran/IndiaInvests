import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { Sheet, Button, Callout } from "./ui";

/** Prompts the user to create a local vault before personal data is persisted. */
export function StorageSetup({ onClose, reason }: { onClose: () => void; reason?: string }) {
  const { createEncryptedVault, createPlaintextVault } = useApp();
  const [mode, setMode] = useState<"choose" | "encrypt">("choose");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doEncrypt() {
    if (p1.length < 8) { setErr("Use at least 8 characters."); return; }
    if (p1 !== p2) { setErr("The two passphrases don't match."); return; }
    setBusy(true);
    await createEncryptedVault(p1);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet title="Set up on-device storage" onClose={onClose}>
      {reason && <div style={{ marginBottom: 12 }}><Callout tone="info">{reason}</Callout></div>}
      {mode === "choose" ? (
        <div className="stack">
          <div className="card" style={{ background: "var(--surface-sunken)", border: "none" }}>
            <h3 style={{ marginTop: 0 }}>Encrypted vault (recommended)</h3>
            <p className="soft">Your data is encrypted with a passphrase using your browser's built-in cryptography. A forgotten passphrase cannot be recovered — keep an encrypted backup.</p>
            <Button variant="primary" onClick={() => setMode("encrypt")}>Create encrypted vault</Button>
          </div>
          <div className="card" style={{ background: "var(--surface-sunken)", border: "none" }}>
            <h3 style={{ marginTop: 0 }}>Unencrypted local storage</h3>
            <p className="soft">Faster to start, but anyone with access to this device/browser profile can read it. You can switch to encrypted later.</p>
            <Button onClick={async () => { await createPlaintextVault(); onClose(); }}>Use without a passphrase</Button>
          </div>
        </div>
      ) : (
        <div>
          <label className="field">
            <span className="field-label">Passphrase</span>
            <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Confirm passphrase</span>
            <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>
          {err && <Callout tone="error">{err}</Callout>}
          <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setMode("choose")}>Back</Button>
            <Button variant="primary" onClick={doEncrypt} disabled={busy}>{busy ? "Creating…" : "Create vault"}</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
