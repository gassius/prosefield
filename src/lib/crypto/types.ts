import "server-only";

/** AES-256-GCM ciphertext package stored alongside Firestore documents. */
export type CipherPackage = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export type EncryptionContext = {
  uid: string;
  docId: string;
  field: string;
};

/**
 * Wraps/unwraps per-document data keys. The KEK never lives in Firebase —
 * production uses Cloud KMS; local/CI uses a Compose/env-loaded dev key.
 */
export interface KeyProvider {
  readonly keyVersion: number;
  wrapDataKey(dataKey: Uint8Array): Promise<Uint8Array>;
  unwrapDataKey(
    wrappedDataKey: Uint8Array,
    keyVersion: number,
  ): Promise<Uint8Array>;
}
