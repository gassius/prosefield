import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyProvider } from "@/lib/crypto/types";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Local/CI KEK provider. The KEK is loaded from env (Compose / `.env`) and
 * never written to Firestore. Supports previous-version unwrap for rotation.
 */
export class DevKeyProvider implements KeyProvider {
  readonly keyVersion: number;
  private readonly keysByVersion: Map<number, Buffer>;

  constructor(input: {
    keyVersion: number;
    currentKek: Buffer;
    previousKeks?: ReadonlyMap<number, Buffer>;
  }) {
    if (input.currentKek.byteLength !== 32) {
      throw new Error("DOCUMENT_ENCRYPTION_KEK must decode to 32 bytes");
    }
    this.keyVersion = input.keyVersion;
    this.keysByVersion = new Map(input.previousKeks ?? []);
    this.keysByVersion.set(input.keyVersion, input.currentKek);
  }

  async wrapDataKey(dataKey: Uint8Array): Promise<Uint8Array> {
    const kek = this.keysByVersion.get(this.keyVersion);
    if (!kek) {
      throw new Error(`Missing KEK for version ${this.keyVersion}`);
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, kek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(dataKey)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // version(1) | iv | tag | ciphertext
    return Buffer.concat([
      Buffer.from([this.keyVersion & 0xff]),
      iv,
      tag,
      ciphertext,
    ]);
  }

  async unwrapDataKey(
    wrappedDataKey: Uint8Array,
    keyVersion: number,
  ): Promise<Uint8Array> {
    const kek = this.keysByVersion.get(keyVersion);
    if (!kek) {
      throw new Error(`No KEK registered for key version ${keyVersion}`);
    }
    const buf = Buffer.from(wrappedDataKey);
    if (buf.byteLength < 1 + IV_BYTES + 16 + 1) {
      throw new Error("Wrapped data key is truncated");
    }
    const storedVersion = buf[0]!;
    if (storedVersion !== (keyVersion & 0xff)) {
      throw new Error("Wrapped key version mismatch");
    }
    const iv = buf.subarray(1, 1 + IV_BYTES);
    const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + 16);
    const ciphertext = buf.subarray(1 + IV_BYTES + 16);
    const decipher = createDecipheriv(ALGO, kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
