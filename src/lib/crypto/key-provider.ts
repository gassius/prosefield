import "server-only";

import { DevKeyProvider } from "@/lib/crypto/dev-key-provider";
import {
  KmsKeyProvider,
  type KmsClient,
} from "@/lib/crypto/kms-key-provider";
import type { KeyProvider } from "@/lib/crypto/types";
import { getEnv } from "@/lib/env";

export type { KeyProvider } from "@/lib/crypto/types";
export { DevKeyProvider } from "@/lib/crypto/dev-key-provider";
export { KmsKeyProvider } from "@/lib/crypto/kms-key-provider";

let cached: KeyProvider | undefined;
let kmsClientOverride: KmsClient | undefined;

/** Test / Firebase Infra hook: inject a KMS client without live GCP. */
export function __setKmsClientForTests(client: KmsClient | undefined): void {
  kmsClientOverride = client;
  cached = undefined;
}

/** Test-only: clear the cached provider. */
export function __resetKeyProviderForTests(): void {
  cached = undefined;
}

function decodeKek(base64: string, label: string): Buffer {
  const buf = Buffer.from(base64, "base64");
  if (buf.byteLength !== 32) {
    throw new Error(`${label} must be standard base64 for exactly 32 bytes`);
  }
  return buf;
}

function createDevProvider(): KeyProvider {
  const env = getEnv();
  const previous = new Map<number, Buffer>();
  if (env.DOCUMENT_ENCRYPTION_KEK_PREVIOUS) {
    previous.set(
      env.DOCUMENT_ENCRYPTION_KEY_VERSION - 1,
      decodeKek(
        env.DOCUMENT_ENCRYPTION_KEK_PREVIOUS,
        "DOCUMENT_ENCRYPTION_KEK_PREVIOUS",
      ),
    );
  }
  return new DevKeyProvider({
    keyVersion: env.DOCUMENT_ENCRYPTION_KEY_VERSION,
    currentKek: decodeKek(
      env.DOCUMENT_ENCRYPTION_KEK!,
      "DOCUMENT_ENCRYPTION_KEK",
    ),
    previousKeks: previous,
  });
}

function createKmsProvider(): KeyProvider {
  const env = getEnv();
  if (!kmsClientOverride) {
    throw new Error(
      "Cloud KMS client is not wired in this environment. Local/CI use DOCUMENT_ENCRYPTION_PROVIDER=dev. Production KMS keyring/IAM is Firebase Infra (Carlos approval).",
    );
  }
  return new KmsKeyProvider(
    kmsClientOverride,
    env.GCP_KMS_KEY_NAME!,
    env.DOCUMENT_ENCRYPTION_KEY_VERSION,
  );
}

export function getKeyProvider(): KeyProvider {
  if (!cached) {
    const env = getEnv();
    cached =
      env.DOCUMENT_ENCRYPTION_PROVIDER === "kms"
        ? createKmsProvider()
        : createDevProvider();
  }
  return cached;
}
