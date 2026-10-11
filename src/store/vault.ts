// Encrypted local vault using the Web Crypto API only (no custom crypto protocol).
//
// Scheme (versioned):
//   - A random 256-bit data key encrypts the serialized state with AES-GCM.
//   - The data key is wrapped by a passphrase-derived key (PBKDF2-SHA256,
//     random 16-byte salt, 310,000 iterations) using AES-GCM.
//   - We store: salt, wrapped-key + its iv, and ciphertext + its iv.
// Forgetting the passphrase is unrecoverable by design — this is stated to the
// user. An encrypted backup is the recovery path.

export const VAULT_SCHEME_VERSION = 1;
const PBKDF2_ITERATIONS = 310000;

export interface EncryptedBlob {
  scheme: number;
  salt: string; // base64
  wrappedKey: string; // base64
  wrapIv: string; // base64
  cipher: string; // base64
  cipherIv: string; // base64
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  // Build on an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>,
  // which satisfies BufferSource (TS 5.6+ distinguishes it from ArrayBufferLike).
  const buf = new ArrayBuffer(bin.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function deriveWrapKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/** Create a fresh random data key (extractable so it can be wrapped). */
async function newDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a plaintext string under a passphrase, producing a storable blob. */
export async function encryptState(plaintext: string, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveWrapKey(passphrase, salt);
  const dataKey = await newDataKey();

  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey("raw", dataKey, wrapKey, {
    name: "AES-GCM",
    iv: wrapIv as BufferSource,
  });

  const cipherIv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: cipherIv as BufferSource },
    dataKey,
    enc.encode(plaintext)
  );

  return {
    scheme: VAULT_SCHEME_VERSION,
    salt: b64(salt),
    wrappedKey: b64(wrapped),
    wrapIv: b64(wrapIv),
    cipher: b64(cipher),
    cipherIv: b64(cipherIv),
  };
}

/** Decrypt a stored blob with a passphrase. Throws on wrong passphrase / tampering. */
export async function decryptState(blob: EncryptedBlob, passphrase: string): Promise<string> {
  if (blob.scheme !== VAULT_SCHEME_VERSION) {
    throw new Error(`Unsupported vault scheme v${blob.scheme}.`);
  }
  const salt = unb64(blob.salt);
  const wrapKey = await deriveWrapKey(passphrase, salt);
  const dataKey = await crypto.subtle.unwrapKey(
    "raw",
    unb64(blob.wrappedKey),
    wrapKey,
    { name: "AES-GCM", iv: unb64(blob.wrapIv) as BufferSource },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(blob.cipherIv) as BufferSource },
    dataKey,
    unb64(blob.cipher)
  );
  return dec.decode(plain);
}

/** Re-wrap an existing blob under a new passphrase (used for passphrase change). */
export async function changePassphrase(
  blob: EncryptedBlob,
  oldPass: string,
  newPass: string
): Promise<EncryptedBlob> {
  const plaintext = await decryptState(blob, oldPass);
  return encryptState(plaintext, newPass);
}
