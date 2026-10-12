// App context: holds state + dispatch, manages the vault lifecycle (locked /
// unlocked / none), and auto-persists encrypted on every change.

import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "../types";
import { reducer, emptyState, Action } from "./state";
import { buildDemoState } from "../demo/demoData";
import {
  loadVault,
  saveEncryptedVault,
  savePlaintextVault,
  clearVault,
  requestPersistentStorage,
  StoredVault,
} from "./db";
import { encryptState, decryptState } from "./vault";

export type VaultStatus =
  | "loading"
  | "none" // no vault yet (calculators-only / fresh)
  | "locked" // encrypted vault exists, needs passphrase
  | "unlocked";

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  vaultStatus: VaultStatus;
  encrypted: boolean;
  /** Create an encrypted vault from the current (in-memory) state. */
  createEncryptedVault: (passphrase: string) => Promise<void>;
  /** Create an unencrypted local vault (explicit user choice). */
  createPlaintextVault: () => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  wipe: () => Promise<void>;
  exportBackup: (passphrase: string) => Promise<Blob>;
  importBackup: (file: File, passphrase: string) => Promise<void>;
  markBackupNow: () => void;
  /** Load the seeded demo persona into memory (never persisted). */
  loadDemo: () => void;
  /** Leave the demo and restore the real vault state. */
  exitDemo: () => void;
  isDemo: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, emptyState());
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>("loading");
  const [encrypted, setEncrypted] = useState(false);
  const passRef = useRef<string | null>(null); // held only in memory while unlocked
  const stored = useRef<StoredVault | null>(null);

  // Initial load.
  useEffect(() => {
    (async () => {
      const v = await loadVault();
      stored.current = v;
      if (!v) {
        setVaultStatus("none");
        setEncrypted(false);
      } else if (v.encrypted) {
        setVaultStatus("locked");
        setEncrypted(true);
      } else {
        // Unencrypted vault: load straight away.
        try {
          const parsed = JSON.parse(v.plaintext!) as AppState;
          dispatch({ type: "REPLACE_STATE", state: parsed });
        } catch {
          /* corrupt — keep empty */
        }
        setEncrypted(false);
        setVaultStatus("unlocked");
      }
    })();
  }, []);

  // Auto-persist whenever state changes and we have an active vault.
  const firstPersist = useRef(true);
  useEffect(() => {
    if (vaultStatus !== "unlocked") return;
    // NEVER persist the demo account — it must not overwrite a real vault.
    if (state.demo) return;
    if (firstPersist.current) {
      firstPersist.current = false;
      // still persist to capture the just-created vault
    }
    (async () => {
      const serialized = JSON.stringify(state);
      if (encrypted && passRef.current) {
        const blob = await encryptState(serialized, passRef.current);
        await saveEncryptedVault(blob);
      } else if (!encrypted) {
        await savePlaintextVault(serialized);
      }
    })().catch(() => {/* quota / write errors surfaced elsewhere */});
  }, [state, vaultStatus, encrypted]);

  async function createEncryptedVault(passphrase: string) {
    if (state.demo) return; // never persist the demo persona into a real vault
    passRef.current = passphrase;
    setEncrypted(true);
    await requestPersistentStorage();
    const blob = await encryptState(JSON.stringify(state), passphrase);
    await saveEncryptedVault(blob);
    setVaultStatus("unlocked");
  }

  async function createPlaintextVault() {
    if (state.demo) return; // never persist the demo persona into a real vault
    passRef.current = null;
    setEncrypted(false);
    await requestPersistentStorage();
    await savePlaintextVault(JSON.stringify(state));
    setVaultStatus("unlocked");
  }

  async function unlock(passphrase: string): Promise<boolean> {
    const v = stored.current;
    if (!v || !v.encrypted || !v.blob) return false;
    try {
      const plain = await decryptState(v.blob, passphrase);
      const parsed = JSON.parse(plain) as AppState;
      passRef.current = passphrase;
      dispatch({ type: "REPLACE_STATE", state: parsed });
      setEncrypted(true);
      setVaultStatus("unlocked");
      return true;
    } catch {
      return false;
    }
  }

  function lock() {
    passRef.current = null;
    dispatch({ type: "REPLACE_STATE", state: emptyState() });
    setVaultStatus("locked");
  }

  async function wipe() {
    passRef.current = null;
    await clearVault();
    dispatch({ type: "RESET_ALL" });
    stored.current = null;
    setEncrypted(false);
    setVaultStatus("none");
  }

  async function exportBackup(passphrase: string): Promise<Blob> {
    const payload = {
      format: "iij-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      blob: await encryptState(JSON.stringify(state), passphrase),
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  }

  async function importBackup(file: File, passphrase: string) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload?.format !== "iij-backup" || !payload.blob) {
      throw new Error("This file is not a valid India Investment Journey backup.");
    }
    const plain = await decryptState(payload.blob, passphrase);
    const parsed = JSON.parse(plain) as AppState;
    if (typeof parsed.schemaVersion !== "number") {
      throw new Error("Backup failed schema validation.");
    }
    dispatch({ type: "REPLACE_STATE", state: parsed });
    // Keep current vault encryption choice; persistence effect will save it.
    if (vaultStatus !== "unlocked") setVaultStatus("unlocked");
  }

  function markBackupNow() {
    dispatch({ type: "MARK_BACKUP", at: new Date().toISOString() });
  }

  function loadDemo() {
    dispatch({ type: "REPLACE_STATE", state: buildDemoState() });
  }

  function exitDemo() {
    // Reload restores the real vault state (locked gate / saved data / empty
    // welcome) and discards the ephemeral demo without any persistence.
    window.location.reload();
  }

  return (
    <AppCtx.Provider
      value={{
        state,
        dispatch,
        vaultStatus,
        encrypted,
        createEncryptedVault,
        createPlaintextVault,
        unlock,
        lock,
        wipe,
        exportBackup,
        importBackup,
        markBackupNow,
        loadDemo,
        exitDemo,
        isDemo: !!state.demo,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}
