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

export async function encryptDocumentFields(
  input: EnvelopeEncryptInput,
): Promise<EncryptedDocumentFields> {
  const provider = input.provider ?? getKeyProvider();
  const dataKey = generateDataKey();
  const wrapped = await provider.wrapDataKey(dataKey);
  const titleCipher = encryptAesGcm(
    input.title,
    dataKey,
    buildAad({ uid: input.uid, docId: input.docId, field: "title" }),
  );
  const contentCipher = encryptAesGcm(
    input.content,
    dataKey,
    buildAad({ uid: input.uid, docId: input.docId, field: "content" }),
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
  );
  const title = decryptAesGcm(
    input.fields.titleCipher,
    dataKey,
    buildAad({ uid: input.uid, docId: input.docId, field: "title" }),
  ).toString("utf8");
  const content = decryptAesGcm(
    input.fields.contentCipher,
    dataKey,
    buildAad({ uid: input.uid, docId: input.docId, field: "content" }),
  ).toString("utf8");
  return { title, content };
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
  const wrapped = await provider.wrapDataKey(dataKey);
  const cipher = encryptAesGcm(
    input.plaintext,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: input.field,
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
  );
  return decryptAesGcm(
    input.cipher,
    dataKey,
    buildAad({
      uid: input.uid,
      docId: input.docId,
      field: input.field,
    }),
  ).toString("utf8");
}

export function isEncryptedDocumentData(
  data: Record<string, unknown>,
): data is Record<string, unknown> & EncryptedDocumentFields {
  return (
    typeof data.wrappedDataKey === "string" &&
    typeof data.keyVersion === "number" &&
    isCipherPackage(data.titleCipher) &&
    isCipherPackage(data.contentCipher)
  );
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
