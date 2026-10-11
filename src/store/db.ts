// Minimal IndexedDB wrapper for a single encrypted vault record plus meta flags.
// No external dependency; one object store keyed by string.

import type { EncryptedBlob } from "./vault";

const DB_NAME = "iij-vault";
const STORE = "kv";
const DB_VERSION = 1;

const VAULT_KEY = "vault";
const PLAINTEXT_KEY = "plaintext"; // used only when the user opts out of encryption

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(key: string): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface StoredVault {
  encrypted: boolean;
  blob?: EncryptedBlob;
  plaintext?: string;
}

export async function loadVault(): Promise<StoredVault | null> {
  const blob = await get<EncryptedBlob>(VAULT_KEY);
  if (blob) return { encrypted: true, blob };
  const plaintext = await get<string>(PLAINTEXT_KEY);
  if (plaintext) return { encrypted: false, plaintext };
  return null;
}

export async function saveEncryptedVault(blob: EncryptedBlob): Promise<void> {
  await del(PLAINTEXT_KEY);
  await set(VAULT_KEY, blob);
}

export async function savePlaintextVault(plaintext: string): Promise<void> {
  await del(VAULT_KEY);
  await set(PLAINTEXT_KEY, plaintext);
}

export async function clearVault(): Promise<void> {
  await del(VAULT_KEY);
  await del(PLAINTEXT_KEY);
}

/** Ask the browser to persist storage so the vault is less likely to be evicted. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function estimateQuota(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return null;
}
