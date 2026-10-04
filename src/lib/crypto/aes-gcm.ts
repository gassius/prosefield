import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { CipherPackage } from "@/lib/crypto/types";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export function assertDataKey(key: Uint8Array): Buffer {
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(`Data key must be ${KEY_BYTES} bytes`);
  }
  return Buffer.from(key);
}

export function generateDataKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function encryptAesGcm(
  plaintext: string | Buffer,
  key: Uint8Array,
  aad: Buffer,
): CipherPackage {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, assertDataKey(key), iv);
  cipher.setAAD(aad);
  const plaintextBuf =
    typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([
    cipher.update(plaintextBuf),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  if (tag.byteLength !== TAG_BYTES) {
    throw new Error("Unexpected GCM tag length");
  }
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptAesGcm(
  pack: CipherPackage,
  key: Uint8Array,
  aad: Buffer,
): Buffer {
  const iv = Buffer.from(pack.iv, "base64");
  const tag = Buffer.from(pack.tag, "base64");
  const ciphertext = Buffer.from(pack.ciphertext, "base64");
  if (iv.byteLength !== IV_BYTES) {
    throw new Error("Invalid IV length");
  }
  if (tag.byteLength !== TAG_BYTES) {
    throw new Error("Invalid auth tag length");
  }
  const decipher = createDecipheriv(ALGO, assertDataKey(key), iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
