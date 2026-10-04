import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetEnvCacheForTests,
  assembleLocalDevEncryptionKek,
} from "@/lib/env";
import {
  __resetKeyProviderForTests,
  __setKmsClientForTests,
  DevKeyProvider,
  KmsKeyProvider,
  getKeyProvider,
} from "@/lib/crypto/key-provider";
import {
  decryptDocumentFields,
  decryptSensitiveString,
  encryptDocumentFields,
  encryptSensitiveString,
} from "@/lib/crypto/envelope";
import { buildAad } from "@/lib/crypto/aad";
import { decryptAesGcm, encryptAesGcm, generateDataKey } from "@/lib/crypto/aes-gcm";

describe("envelope encryption", () => {
  beforeEach(() => {
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "1";
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    __resetEnvCacheForTests();
    __resetKeyProviderForTests();
    __setKmsClientForTests(undefined);
  });

  afterEach(() => {
    __resetKeyProviderForTests();
    __setKmsClientForTests(undefined);
    __resetEnvCacheForTests();
  });

  it("round-trips title and content", async () => {
    const encrypted = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "Brief",
      content: JSON.stringify({ type: "doc", content: [] }),
    });
    const decrypted = await decryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      fields: encrypted,
    });
    expect(decrypted.title).toBe("Brief");
    expect(decrypted.content).toContain('"type":"doc"');
  });

  it("throws when ciphertext, IV, tag, or AAD is tampered", async () => {
    const encrypted = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "T",
      content: "secret-body",
    });

    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "doc-1",
        fields: {
          ...encrypted,
          contentCipher: {
            ...encrypted.contentCipher,
            ciphertext: Buffer.from("tampered").toString("base64"),
          },
        },
      }),
    ).rejects.toThrow();

    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "doc-1",
        fields: {
          ...encrypted,
          contentCipher: {
            ...encrypted.contentCipher,
            iv: Buffer.alloc(12, 9).toString("base64"),
          },
        },
      }),
    ).rejects.toThrow();

    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "doc-1",
        fields: {
          ...encrypted,
          contentCipher: {
            ...encrypted.contentCipher,
            tag: Buffer.alloc(16, 1).toString("base64"),
          },
        },
      }),
    ).rejects.toThrow();

    await expect(
      decryptDocumentFields({
        uid: "other-user",
        docId: "doc-1",
        fields: encrypted,
      }),
    ).rejects.toThrow();

    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "other-doc",
        fields: encrypted,
      }),
    ).rejects.toThrow();
  });

  it("fails with the wrong KEK", async () => {
    const encrypted = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "T",
      content: "body",
    });
    const wrong = new DevKeyProvider({
      keyVersion: 1,
      currentKek: Buffer.alloc(32, 0x99),
    });
    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "doc-1",
        fields: encrypted,
        provider: wrong,
      }),
    ).rejects.toThrow();
  });

  it("uses a unique IV per write", async () => {
    const a = await encryptDocumentFields({
      uid: "u",
      docId: "d",
      title: "same",
      content: "same",
    });
    const b = await encryptDocumentFields({
      uid: "u",
      docId: "d",
      title: "same",
      content: "same",
    });
    expect(a.contentCipher.iv).not.toBe(b.contentCipher.iv);
    expect(a.titleCipher.iv).not.toBe(b.titleCipher.iv);
    expect(a.wrappedDataKey).not.toBe(b.wrappedDataKey);
  });

  it("supports key-version rotation via previous KEK", async () => {
    const oldKek = Buffer.alloc(32, 0x11);
    const newKek = Buffer.alloc(32, 0x22);
    const v1 = new DevKeyProvider({ keyVersion: 1, currentKek: oldKek });
    const encrypted = await encryptDocumentFields({
      uid: "u",
      docId: "d",
      title: "rot",
      content: "payload",
      provider: v1,
    });
    const v2 = new DevKeyProvider({
      keyVersion: 2,
      currentKek: newKek,
      previousKeks: new Map([[1, oldKek]]),
    });
    const decrypted = await decryptDocumentFields({
      uid: "u",
      docId: "d",
      fields: encrypted,
      provider: v2,
    });
    expect(decrypted.content).toBe("payload");
  });

  it("encrypts sensitive profile strings with AAD binding", async () => {
    const packed = await encryptSensitiveString({
      uid: "u1",
      docId: "u1",
      field: "email",
      plaintext: "a@example.com",
    });
    await expect(
      decryptSensitiveString({
        uid: "u1",
        docId: "u1",
        field: "email",
        ...packed,
      }),
    ).resolves.toBe("a@example.com");
    await expect(
      decryptSensitiveString({
        uid: "u2",
        docId: "u1",
        field: "email",
        ...packed,
      }),
    ).rejects.toThrow();
  });

  it("AES-GCM helpers reject bad key / IV / tag lengths", () => {
    const key = generateDataKey();
    const aad = buildAad({ uid: "u", docId: "d", field: "content" });
    const pack = encryptAesGcm("hi", key, aad);
    expect(() => encryptAesGcm("x", Buffer.alloc(16), aad)).toThrow(/32 bytes/);
    expect(() =>
      decryptAesGcm({ ...pack, iv: Buffer.alloc(8).toString("base64") }, key, aad),
    ).toThrow(/IV/);
    expect(() =>
      decryptAesGcm({ ...pack, tag: Buffer.alloc(8).toString("base64") }, key, aad),
    ).toThrow(/tag/);
  });

  it("KmsKeyProvider wraps and unwraps through the injectable client", async () => {
    const store = new Map<string, Uint8Array>();
    const client = {
      encrypt: vi.fn(async ({ plaintext }: { plaintext: Uint8Array }) => {
        const ciphertext = Buffer.concat([
          Buffer.from("kms:"),
          Buffer.from(plaintext),
        ]);
        store.set(ciphertext.toString("base64"), plaintext);
        return { ciphertext };
      }),
      decrypt: vi.fn(async ({ ciphertext }: { ciphertext: Uint8Array }) => {
        const key = Buffer.from(ciphertext).toString("base64");
        const plaintext = store.get(key);
        if (!plaintext) {
          throw new Error("unknown ciphertext");
        }
        return { plaintext };
      }),
    };
    const provider = new KmsKeyProvider(client, "projects/p/locations/l/keyRings/r/cryptoKeys/k", 3);
    const dataKey = generateDataKey();
    const wrapped = await provider.wrapDataKey(dataKey);
    const unwrapped = await provider.unwrapDataKey(wrapped, 3);
    expect(Buffer.from(unwrapped).equals(dataKey)).toBe(true);
    expect(client.encrypt).toHaveBeenCalled();
    expect(client.decrypt).toHaveBeenCalled();
  });

  it("getKeyProvider selects dev by default and kms when configured with a client", async () => {
    expect(getKeyProvider()).toBeInstanceOf(DevKeyProvider);

    __resetKeyProviderForTests();
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "kms";
    process.env.GCP_KMS_KEY_NAME =
      "projects/p/locations/l/keyRings/r/cryptoKeys/k";
    __resetEnvCacheForTests();
    expect(() => getKeyProvider()).toThrow(/not wired/);

    __setKmsClientForTests({
      encrypt: async ({ plaintext }) => ({ ciphertext: plaintext }),
      decrypt: async ({ ciphertext }) => ({ plaintext: ciphertext }),
    });
    expect(getKeyProvider()).toBeInstanceOf(KmsKeyProvider);
  });

  it("covers DevKeyProvider / KmsKeyProvider error paths and previous KEK wiring", async () => {
    expect(
      () =>
        new DevKeyProvider({
          keyVersion: 1,
          currentKek: Buffer.alloc(16),
        }),
    ).toThrow(/32 bytes/);

    const kek = Buffer.alloc(32, 0x33);
    const provider = new DevKeyProvider({ keyVersion: 1, currentKek: kek });
    const wrapped = await provider.wrapDataKey(generateDataKey());
    await expect(provider.unwrapDataKey(wrapped, 9)).rejects.toThrow(
      /No KEK registered/,
    );
    await expect(provider.unwrapDataKey(Buffer.alloc(4), 1)).rejects.toThrow(
      /truncated/,
    );
    const mismatched = Buffer.from(wrapped);
    mismatched[0] = 2;
    await expect(provider.unwrapDataKey(mismatched, 1)).rejects.toThrow(
      /version mismatch/,
    );

    expect(() => new KmsKeyProvider({ encrypt: async () => ({ ciphertext: new Uint8Array() }), decrypt: async () => ({ plaintext: new Uint8Array() }) }, "   ", 1)).toThrow(
      /GCP_KMS_KEY_NAME/,
    );
    const kms = new KmsKeyProvider(
      {
        encrypt: async ({ plaintext }) => ({ ciphertext: plaintext }),
        decrypt: async ({ ciphertext }) => ({ plaintext: ciphertext }),
      },
      "projects/p/locations/l/keyRings/r/cryptoKeys/k",
      1,
    );
    await expect(kms.unwrapDataKey(Buffer.from([1]), 1)).rejects.toThrow(
      /truncated/,
    );
    const okWrap = await kms.wrapDataKey(generateDataKey());
    const badVer = Buffer.from(okWrap);
    badVer[0] = 9;
    await expect(kms.unwrapDataKey(badVer, 1)).rejects.toThrow(/version mismatch/);

    __resetKeyProviderForTests();
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "2";
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    process.env.DOCUMENT_ENCRYPTION_KEK_PREVIOUS = Buffer.alloc(32, 0x11).toString(
      "base64",
    );
    __resetEnvCacheForTests();
    const withPrev = getKeyProvider();
    expect(withPrev.keyVersion).toBe(2);

    __resetKeyProviderForTests();
    process.env.DOCUMENT_ENCRYPTION_KEK = Buffer.alloc(8).toString("base64");
    __resetEnvCacheForTests();
    expect(() => getKeyProvider()).toThrow(/32 bytes/);
  });

  it("isEncryptedDocumentData rejects incomplete cipher packages", async () => {
    const { isEncryptedDocumentData } = await import("@/lib/crypto/envelope");
    expect(isEncryptedDocumentData({})).toBe(false);
    expect(
      isEncryptedDocumentData({
        keyVersion: 1,
        wrappedDataKey: "x",
        titleCipher: null,
        contentCipher: { ciphertext: "a", iv: "b", tag: "c" },
      }),
    ).toBe(false);
    expect(
      isEncryptedDocumentData({
        keyVersion: 1,
        wrappedDataKey: "x",
        titleCipher: { ciphertext: "a", iv: "b", tag: 3 },
        contentCipher: { ciphertext: "a", iv: "b", tag: "c" },
      }),
    ).toBe(false);
    expect(
      encryptAesGcm(Buffer.from("buf"), generateDataKey(), buildAad({
        uid: "u",
        docId: "d",
        field: "content",
      })).ciphertext.length,
    ).toBeGreaterThan(0);
  });
});
