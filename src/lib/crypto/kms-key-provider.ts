import "server-only";

import type { KeyProvider } from "@/lib/crypto/types";

const VERSION_BYTES = 4;

function encodeVersion(version: number): Buffer {
  const buf = Buffer.alloc(VERSION_BYTES);
  buf.writeUInt32BE(version >>> 0);
  return buf;
}

function decodeVersion(buf: Buffer): number {
  return buf.readUInt32BE(0);
}

/**
 * Minimal Cloud KMS client surface used for DEK wrap/unwrap.
 * Wired in production by Firebase Infra (Carlos approval) — not live here.
 */
export type KmsClient = {
  encrypt(request: {
    name: string;
    plaintext: Uint8Array;
    additionalAuthenticatedData?: Uint8Array;
  }): Promise<{ ciphertext: Uint8Array }>;
  decrypt(request: {
    name: string;
    ciphertext: Uint8Array;
    additionalAuthenticatedData?: Uint8Array;
  }): Promise<{ plaintext: Uint8Array }>;
};

/**
 * Production KeyProvider: Cloud KMS encrypts the per-document data key.
 * The KEK never leaves KMS / never enters Firebase.
 *
 * Wrapped key layout: version(4 BE) | kmsCiphertext. Full uint32 version.
 */
export class KmsKeyProvider implements KeyProvider {
  readonly keyVersion: number;

  constructor(
    private readonly client: KmsClient,
    private readonly keyName: string,
    keyVersion: number,
  ) {
    if (!keyName.trim()) {
      throw new Error("GCP_KMS_KEY_NAME is required for the KMS provider");
    }
    this.keyVersion = keyVersion;
  }

  async wrapDataKey(dataKey: Uint8Array, aad: Buffer): Promise<Uint8Array> {
    const result = await this.client.encrypt({
      name: this.keyName,
      plaintext: dataKey,
      additionalAuthenticatedData: aad,
    });
    return Buffer.concat([
      encodeVersion(this.keyVersion),
      Buffer.from(result.ciphertext),
    ]);
  }

  async unwrapDataKey(
    wrappedDataKey: Uint8Array,
    keyVersion: number,
    aad: Buffer,
  ): Promise<Uint8Array> {
    const buf = Buffer.from(wrappedDataKey);
    if (buf.byteLength < VERSION_BYTES + 1) {
      throw new Error("Wrapped data key is truncated");
    }
    const storedVersion = decodeVersion(buf.subarray(0, VERSION_BYTES));
    if (storedVersion !== keyVersion) {
      throw new Error("Wrapped key version mismatch");
    }
    const result = await this.client.decrypt({
      name: this.keyName,
      ciphertext: buf.subarray(VERSION_BYTES),
      additionalAuthenticatedData: aad,
    });
    return Buffer.from(result.plaintext);
  }
}
