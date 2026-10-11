import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { Card, Button, Callout } from "../components/ui";

export function VaultGate() {
  const { unlock, wipe } = useApp();
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  async function doUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await unlock(pass);
    setBusy(false);
    if (!ok) setError("That passphrase didn't unlock the vault. There is no way to recover a forgotten passphrase — if you've lost it, you can start fresh (your current encrypted data cannot be read without it).");
    setPass("");
  }

  return (
    <div style={{ maxWidth: 440, margin: "90px auto", padding: 16 }}>
      <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
        <div className="brand-mark" aria-hidden />
        <div className="brand-name" style={{ fontSize: "1.1rem" }}>India Investment Journey</div>
      </div>
      <Card>
        <h2>Unlock your vault</h2>
        <p className="soft">Your portfolio and goals are encrypted on this device. Enter your passphrase to continue.</p>
        <form onSubmit={doUnlock}>
          <input
            type="password"
            autoFocus
            value={pass}
            placeholder="Passphrase"
            onChange={(e) => setPass(e.target.value)}
            aria-label="Vault passphrase"
            style={{ marginBottom: 12 }}
          />
          {error && <div style={{ marginBottom: 12 }}><Callout tone="error">{error}</Callout></div>}
          <Button variant="primary" type="submit" disabled={busy || !pass} style={{ width: "100%" }}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
        <hr className="hr" />
        {!confirmWipe ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(true)}>Forgot passphrase / start fresh</Button>
        ) : (
          <Callout tone="warn">
            Starting fresh permanently deletes the encrypted vault on this device. If you have an encrypted backup file you can restore it afterwards.
            <div className="row" style={{ marginTop: 10 }}>
              <Button variant="danger" size="sm" onClick={() => wipe()}>Delete and start fresh</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>Cancel</Button>
            </div>
          </Callout>
        )}
      </Card>
    </div>
  );
}
