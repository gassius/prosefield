import "server-only";

import type { EncryptionContext } from "@/lib/crypto/types";

/** AAD binds ciphertext to owner + document + field so blobs cannot be moved. */
export function buildAad(context: EncryptionContext): Buffer {
  return Buffer.from(
    `${context.uid}\0${context.docId}\0${context.field}`,
    "utf8",
  );
}
