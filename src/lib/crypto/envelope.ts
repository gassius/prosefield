import "server-only";

import { buildAad } from "@/lib/crypto/aad";
import {
  decryptAesGcm,
  encryptAesGcm,
  generateDataKey,
} from "@/lib/crypto/aes-gcm";
import { getKeyProvider } from "@/lib/crypto/key-provider";
import type { CipherPackage, KeyProvider } from "@/lib/crypto/types";

export type EncryptedDocumentFields = {
  keyVersion: number;
  wrappedDataKey: string;
  titleCipher: CipherPackage;
  contentCipher: CipherPackage;
};

export type EnvelopeEncryptInput = {
  uid: string;
  docId: string;
  title: string;
  content: string;
  provider?: KeyProvider;
};

function dekAad(uid: string, docId: string, keyVersion: number) {
  return buildAad({ uid, docId, field: "dek", keyVersion });
}

export async function encryptDocumentFields(
  input: EnvelopeEncryptInput,
): Promise<EncryptedDocumentFields> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = generateDataKey();
  const wrapped = await provider.wrapDataKey(
    dataKey,
    dekAad(input.uid, input.docId, provider.keyVersion),
  );
  const titleCipher = encryptAesGcm(
    input.title,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "title",
      keyVersion: provider.keyVersion,
    }),
  );
  const contentCipher = encryptAesGcm(
    input.content,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "content",
      keyVersion: provider.keyVersion,
    }),
  );
  return {
    keyVersion: provider.keyVersion,
    wrappedDataKey: Buffer.from(wrapped).toString("base64"),
    titleCipher,
    contentCipher,
  };
}

export type EnvelopeDecryptInput = {
  uid: string;
  docId: string;
  fields: EncryptedDocumentFields;
  provider?: KeyProvider;
};

export async function decryptDocumentFields(
  input: EnvelopeDecryptInput,
): Promise<{ title: string; content: string }> {
  const provider = input.provider ?? getKeyProvider();
  const wrapped = Buffer.from(input.fields.wrappedDataKey, "base64");
  const dataKey = await provider.unwrapDataKey(
    wrapped,
    input.fields.keyVersion,
    dekAad(input.uid, input.docId, input.fields.keyVersion),
  );
  const title = decryptAesGcm(
    input.fields.titleCipher,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "title",
      keyVersion: input.fields.keyVersion,
    }),
  ).toString("utf8");
  const content = decryptAesGcm(
    input.fields.contentCipher,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "content",
      keyVersion: input.fields.keyVersion,
    }),
  ).toString("utf8");
  return { title, content };
}

/** Decrypt title only (list view) — does not touch content ciphertext. */
export async function decryptDocumentTitle(input: {
  uid: string;
  docId: string;
  fields: Pick<
    EncryptedDocumentFields,
    "keyVersion" | "wrappedDataKey" | "titleCipher"
  >;
  provider?: KeyProvider;
}): Promise<string> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = await provider.unwrapDataKey(
    Buffer.from(input.fields.wrappedDataKey, "base64"),
    input.fields.keyVersion,
    dekAad(input.uid, input.docId, input.fields.keyVersion),
  );
  return decryptAesGcm(
    input.fields.titleCipher,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "title",
      keyVersion: input.fields.keyVersion,
    }),
  ).toString("utf8");
}

/**
 * Re-encrypt only the title under the existing DEK; leave contentCipher and
 * wrappedDataKey unchanged so off-spec content is never rewritten.
 */
export async function reencryptDocumentTitle(input: {
  uid: string;
  docId: string;
  title: string;
  fields: EncryptedDocumentFields;
  provider?: KeyProvider;
}): Promise<CipherPackage> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = await provider.unwrapDataKey(
    Buffer.from(input.fields.wrappedDataKey, "base64"),
    input.fields.keyVersion,
    dekAad(input.uid, input.docId, input.fields.keyVersion),
  );
  return encryptAesGcm(
    input.title,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: "title",
      keyVersion: input.fields.keyVersion,
    }),
  );
}

/** Encrypt a single sensitive string (profile fields) with a fresh DEK. */
export async function encryptSensitiveString(input: {
  uid: string;
  docId: string;
  field: string;
  plaintext: string;
  provider?: KeyProvider;
}): Promise<{
  keyVersion: number;
  wrappedDataKey: string;
  cipher: CipherPackage;
}> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = generateDataKey();
  const wrapped = await provider.wrapDataKey(
    dataKey,
    dekAad(input.uid, input.docId, provider.keyVersion),
  );
  const cipher = encryptAesGcm(
    input.plaintext,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: input.field,
      keyVersion: provider.keyVersion,
    }),
  );
  return {
    keyVersion: provider.keyVersion,
    wrappedDataKey: Buffer.from(wrapped).toString("base64"),
    cipher,
  };
}

export async function decryptSensitiveString(input: {
  uid: string;
  docId: string;
  field: string;
  keyVersion: number;
  wrappedDataKey: string;
  cipher: CipherPackage;
  provider?: KeyProvider;
}): Promise<string> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = await provider.unwrapDataKey(
    Buffer.from(input.wrappedDataKey, "base64"),
    input.keyVersion,
    dekAad(input.uid, input.docId, input.keyVersion),
  );
  return decryptAesGcm(
    input.cipher,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: input.field,
      keyVersion: input.keyVersion,
    }),
  ).toString("utf8");
}

export function isEncryptedDocumentData(
  data: Record<string, unknown>,
): data is Record<string, unknown> & EncryptedDocumentFields {
  return (
    typeof data.wrappedDataKey === "string" &&
    typeof data.keyVersion === "number" &&
    Number.isInteger(data.keyVersion) &&
    isCipherPackage(data.titleCipher) &&
    isCipherPackage(data.contentCipher)
  );
}

/** True when any envelope field is present but the package is not valid. */
export function isMalformedEncryptedDocumentData(
  data: Record<string, unknown>,
): boolean {
  const hasAny =
    data.wrappedDataKey !== undefined ||
    data.keyVersion !== undefined ||
    data.titleCipher !== undefined ||
    data.contentCipher !== undefined;
  return hasAny && !isEncryptedDocumentData(data);
}

function isCipherPackage(value: unknown): value is CipherPackage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const pack = value as Record<string, unknown>;
  return (
    typeof pack.ciphertext === "string" &&
    typeof pack.iv === "string" &&
    typeof pack.tag === "string"
  );
}
