import "server-only";

import type { EncryptionContext } from "@/lib/crypto/types";

function lengthPrefixed(parts: Buffer[]): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(part.byteLength);
    chunks.push(len, part);
  }
  return Buffer.concat(chunks);
}

/**
 * AAD binds ciphertext to owner + document + field + key version so blobs
 * cannot be moved or version-confused. Length-prefixed (not NUL-joined) so
 * components may contain any UTF-8 byte without ambiguity.
 */
export function buildAad(context: EncryptionContext): Buffer {
  const version = Buffer.alloc(4);
  version.writeUInt32BE(context.keyVersion >>> 0);
  return lengthPrefixed([
    Buffer.from(context.uid, "utf8"),
    Buffer.from(context.docId, "utf8"),
    Buffer.from(context.field, "utf8"),
    version,
  ]);
}
