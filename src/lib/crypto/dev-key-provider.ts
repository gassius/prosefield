import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyProvider } from "@/lib/crypto/types";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
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
 * Local/CI KEK provider. The KEK is loaded from env (Compose / `.env`) and
 * never written to Firestore. Supports previous-version unwrap for rotation.
 *
 * Wrapped key layout: version(4 BE) | iv(12) | tag(16) | ciphertext.
 * Full uint32 version — no single-byte aliasing.
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

  async wrapDataKey(dataKey: Uint8Array, aad: Buffer): Promise<Uint8Array> {
    // Constructor always registers `keyVersion` → present.
    const kek = this.keysByVersion.get(this.keyVersion)!;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, kek, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(dataKey)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([
      encodeVersion(this.keyVersion),
      iv,
      tag,
      ciphertext,
    ]);
  }

  async unwrapDataKey(
    wrappedDataKey: Uint8Array,
    keyVersion: number,
    aad: Buffer,
  ): Promise<Uint8Array> {
    const kek = this.keysByVersion.get(keyVersion);
    if (!kek) {
      throw new Error(`No KEK registered for key version ${keyVersion}`);
    }
    const buf = Buffer.from(wrappedDataKey);
    const minLen = VERSION_BYTES + IV_BYTES + 16 + 1;
    if (buf.byteLength < minLen) {
      throw new Error("Wrapped data key is truncated");
    }
    const storedVersion = decodeVersion(buf.subarray(0, VERSION_BYTES));
    if (storedVersion !== keyVersion) {
      throw new Error("Wrapped key version mismatch");
    }
    const iv = buf.subarray(VERSION_BYTES, VERSION_BYTES + IV_BYTES);
    const tag = buf.subarray(
      VERSION_BYTES + IV_BYTES,
      VERSION_BYTES + IV_BYTES + 16,
    );
    const ciphertext = buf.subarray(VERSION_BYTES + IV_BYTES + 16);
    const decipher = createDecipheriv(ALGO, kek, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
