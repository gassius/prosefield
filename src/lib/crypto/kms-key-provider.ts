import "server-only";

import type { KeyProvider } from "@/lib/crypto/types";

/**
 * Minimal Cloud KMS client surface used for DEK wrap/unwrap.
 * Wired in production by Firebase Infra (Carlos approval) — not live here.
 */
export type KmsClient = {
  encrypt(request: {
    name: string;
    plaintext: Uint8Array;
  }): Promise<{ ciphertext: Uint8Array }>;
  decrypt(request: {
    name: string;
    ciphertext: Uint8Array;
  }): Promise<{ plaintext: Uint8Array }>;
};

/**
 * Production KeyProvider: Cloud KMS encrypts the per-document data key.
 * The KEK never leaves KMS / never enters Firebase.
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

  async wrapDataKey(dataKey: Uint8Array): Promise<Uint8Array> {
    const result = await this.client.encrypt({
      name: this.keyName,
      plaintext: dataKey,
    });
    // Prefix the app key-version byte so rotation can select the right unwrap path.
    return Buffer.concat([
      Buffer.from([this.keyVersion & 0xff]),
      Buffer.from(result.ciphertext),
    ]);
  }

  async unwrapDataKey(
    wrappedDataKey: Uint8Array,
    keyVersion: number,
  ): Promise<Uint8Array> {
    const buf = Buffer.from(wrappedDataKey);
    if (buf.byteLength < 2) {
      throw new Error("Wrapped data key is truncated");
    }
    const storedVersion = buf[0]!;
    if (storedVersion !== (keyVersion & 0xff)) {
      throw new Error("Wrapped key version mismatch");
    }
    const result = await this.client.decrypt({
      name: this.keyName,
      ciphertext: buf.subarray(1),
    });
    return Buffer.from(result.plaintext);
  }
}
