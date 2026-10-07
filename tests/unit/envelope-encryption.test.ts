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
  isEncryptedDocumentData,
  isMalformedEncryptedDocumentData,
} from "@/lib/crypto/envelope";
import { buildAad } from "@/lib/crypto/aad";
import { decryptAesGcm, encryptAesGcm, generateDataKey } from "@/lib/crypto/aes-gcm";

function aad(field: string, keyVersion = 1) {
  return buildAad({ uid: "u", docId: "d", field, keyVersion });
}

describe("envelope encryption", () => {
  beforeEach(() => {
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "1";
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    delete process.env.DOCUMENT_ENCRYPTION_KEK_PREVIOUS;
    __resetEnvCacheForTests();
    __resetKeyProviderForTests();
    __setKmsClientForTests(undefined);
  });

  afterEach(() => {
    __resetKeyProviderForTests();
    __setKmsClientForTests(undefined);
    __resetEnvCacheForTests();
  });


  it("round-trips ignoredWords with the same DEK; legacy missing cipher defaults to []", async () => {
    const encrypted = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "Brief",
      content: "body",
      ignoredWords: JSON.stringify(["teh", "mispelled"]),
    });
    expect(encrypted.ignoredWordsCipher).toBeDefined();
    const decrypted = await decryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      fields: encrypted,
    });
    expect(JSON.parse(decrypted.ignoredWords)).toEqual(["teh", "mispelled"]);

    const legacy = {
      keyVersion: encrypted.keyVersion,
      wrappedDataKey: encrypted.wrappedDataKey,
      titleCipher: encrypted.titleCipher,
      contentCipher: encrypted.contentCipher,
    };
    const legacyDecrypted = await decryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      fields: legacy,
    });
    expect(legacyDecrypted.ignoredWords).toBe("[]");
  });

  it("treats ignoredWordsCipher bound to a different DEK as empty (does not brick content)", async () => {
    const first = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "Brief",
      content: "body-v1",
      ignoredWords: JSON.stringify(["teh"]),
    });
    const second = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "Brief",
      content: "body-v2",
      ignoredWords: JSON.stringify([]),
    });
    // Stale ignore cipher from `first` + DEK from `second`.
    const decrypted = await decryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      fields: {
        ...second,
        ignoredWordsCipher: first.ignoredWordsCipher,
      },
    });
    expect(decrypted.content).toBe("body-v2");
    expect(decrypted.ignoredWords).toBe("[]");
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

  it("rejects title ciphertext swapped into the content slot (A4)", async () => {
    const encrypted = await encryptDocumentFields({
      uid: "user-1",
      docId: "doc-1",
      title: "TitleOnly",
      content: "ContentOnly",
    });
    await expect(
      decryptDocumentFields({
        uid: "user-1",
        docId: "doc-1",
        fields: {
          ...encrypted,
          contentCipher: encrypted.titleCipher,
        },
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

  it("uses a unique IV per field write and per DEK wrap (I1/I2)", async () => {
    const provider = getKeyProvider();
    const dekAad = aad("dek", provider.keyVersion);
    const wrapA = await provider.wrapDataKey(generateDataKey(), dekAad);
    const wrapB = await provider.wrapDataKey(generateDataKey(), dekAad);
    // Same DEK length; wrap IV must differ so prefix+iv slices differ after version.
    expect(Buffer.from(wrapA).subarray(4, 16).equals(Buffer.from(wrapB).subarray(4, 16))).toBe(
      false,
    );

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

  it("generates a fresh random DEK per encrypt (I3)", async () => {
    const seen = new Set<string>();
    const provider = new DevKeyProvider({
      keyVersion: 1,
      currentKek: Buffer.alloc(32, 0x44),
    });
    for (let i = 0; i < 8; i += 1) {
      const wrapped = await provider.wrapDataKey(generateDataKey(), aad("dek"));
      const dek = await provider.unwrapDataKey(wrapped, 1, aad("dek"));
      const hex = Buffer.from(dek).toString("hex");
      expect(seen.has(hex)).toBe(false);
      seen.add(hex);
    }
  });

  it("DEK unwrap authenticates via GCM final (T3)", async () => {
    const provider = new DevKeyProvider({
      keyVersion: 1,
      currentKek: Buffer.alloc(32, 0x55),
    });
    const wrapped = Buffer.from(
      await provider.wrapDataKey(generateDataKey(), aad("dek")),
    );
    // Flip a ciphertext byte after the tag — unwrap must fail auth, not return garbage.
    wrapped[wrapped.byteLength - 1] ^= 0xff;
    await expect(provider.unwrapDataKey(wrapped, 1, aad("dek"))).rejects.toThrow();
  });

  it("DevKeyProvider DEK-wrap AAD binds uid/docId/field (W1/W2)", async () => {
    const provider = new DevKeyProvider({
      keyVersion: 1,
      currentKek: Buffer.alloc(32, 0x66),
    });
    const wrapped = await provider.wrapDataKey(
      generateDataKey(),
      aad("dek", 1),
    );
    // Wrong field name in AAD must fail unwrap (W1: setAAD dropped / W2: constant AAD).
    await expect(
      provider.unwrapDataKey(wrapped, 1, aad("title", 1)),
    ).rejects.toThrow();
    // Wrong doc binding (other docId) must fail.
    await expect(
      provider.unwrapDataKey(
        wrapped,
        1,
        buildAad({ uid: "u", docId: "other-doc", field: "dek", keyVersion: 1 }),
      ),
    ).rejects.toThrow();
    // Matching AAD still unwraps.
    await expect(
      provider.unwrapDataKey(wrapped, 1, aad("dek", 1)),
    ).resolves.toBeInstanceOf(Uint8Array);
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

  it("env-wired previous KEK decrypts a v1 document (V3)", async () => {
    const oldKek = Buffer.alloc(32, 0x11);
    const v1 = new DevKeyProvider({ keyVersion: 1, currentKek: oldKek });
    const encrypted = await encryptDocumentFields({
      uid: "u",
      docId: "d",
      title: "v1",
      content: "still-readable",
      provider: v1,
    });

    __resetKeyProviderForTests();
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "2";
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    process.env.DOCUMENT_ENCRYPTION_KEK_PREVIOUS = oldKek.toString("base64");
    __resetEnvCacheForTests();

    const decrypted = await decryptDocumentFields({
      uid: "u",
      docId: "d",
      fields: encrypted,
    });
    expect(decrypted.content).toBe("still-readable");
    expect(getKeyProvider().keyVersion).toBe(2);
  });

  it("stores a full uint32 version prefix (no 257→1 alias)", async () => {
    const kek = Buffer.alloc(32, 0x66);
    const provider = new DevKeyProvider({
      keyVersion: 257,
      currentKek: kek,
      previousKeks: new Map([[1, kek]]),
    });
    const wrapped = Buffer.from(
      await provider.wrapDataKey(generateDataKey(), aad("dek", 257)),
    );
    expect(wrapped.readUInt32BE(0)).toBe(257);
    // With a single-byte alias, version 257 would unwrap as v1 — must not.
    await expect(
      provider.unwrapDataKey(wrapped, 1, aad("dek", 1)),
    ).rejects.toThrow(/version mismatch/);
    await expect(
      provider.unwrapDataKey(wrapped, 257, aad("dek", 257)),
    ).resolves.toBeTruthy();
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
    const pack = encryptAesGcm("hi", key, aad("content"));
    expect(() => encryptAesGcm("x", Buffer.alloc(16), aad("content"))).toThrow(
      /32 bytes/,
    );
    expect(() =>
      decryptAesGcm(
        { ...pack, iv: Buffer.alloc(8).toString("base64") },
        key,
        aad("content"),
      ),
    ).toThrow(/IV/);
    expect(() =>
      decryptAesGcm(
        { ...pack, tag: Buffer.alloc(8).toString("base64") },
        key,
        aad("content"),
      ),
    ).toThrow(/tag/);
  });

  it("KmsKeyProvider wraps and unwraps through the injectable client", async () => {
    const store = new Map<string, Uint8Array>();
    const client = {
      encrypt: vi.fn(
        async ({
          plaintext,
          additionalAuthenticatedData,
        }: {
          plaintext: Uint8Array;
          additionalAuthenticatedData?: Uint8Array;
        }) => {
          expect(additionalAuthenticatedData?.byteLength).toBeGreaterThan(0);
          const ciphertext = Buffer.concat([
            Buffer.from("kms:"),
            Buffer.from(plaintext),
          ]);
          store.set(ciphertext.toString("base64"), plaintext);
          return { ciphertext };
        },
      ),
      decrypt: vi.fn(
        async ({
          ciphertext,
          additionalAuthenticatedData,
        }: {
          ciphertext: Uint8Array;
          additionalAuthenticatedData?: Uint8Array;
        }) => {
          expect(additionalAuthenticatedData?.byteLength).toBeGreaterThan(0);
          const key = Buffer.from(ciphertext).toString("base64");
          const plaintext = store.get(key);
          if (!plaintext) {
            throw new Error("unknown ciphertext");
          }
          return { plaintext };
        },
      ),
    };
    const provider = new KmsKeyProvider(
      client,
      "projects/p/locations/l/keyRings/r/cryptoKeys/k",
      3,
    );
    const dataKey = generateDataKey();
    const wrapped = await provider.wrapDataKey(dataKey, aad("dek", 3));
    const unwrapped = await provider.unwrapDataKey(wrapped, 3, aad("dek", 3));
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

  it("getKeyProvider decodeKek rejects wrong-length current and previous KEKs", async () => {
    const { getEnv } = await import("@/lib/env");
    __resetKeyProviderForTests();
    const env = getEnv();
    const originalKek = env.DOCUMENT_ENCRYPTION_KEK;
    (env as { DOCUMENT_ENCRYPTION_KEK?: string }).DOCUMENT_ENCRYPTION_KEK =
      Buffer.alloc(16).toString("base64");
    expect(() => getKeyProvider()).toThrow(
      /DOCUMENT_ENCRYPTION_KEK must be standard base64 for exactly 32 bytes/,
    );
    (env as { DOCUMENT_ENCRYPTION_KEK?: string }).DOCUMENT_ENCRYPTION_KEK =
      originalKek;
    __resetKeyProviderForTests();

    (env as { DOCUMENT_ENCRYPTION_KEK_PREVIOUS?: string }).DOCUMENT_ENCRYPTION_KEK_PREVIOUS =
      Buffer.alloc(8).toString("base64");
    expect(() => getKeyProvider()).toThrow(
      /DOCUMENT_ENCRYPTION_KEK_PREVIOUS must be standard base64 for exactly 32 bytes/,
    );
    delete (env as { DOCUMENT_ENCRYPTION_KEK_PREVIOUS?: string })
      .DOCUMENT_ENCRYPTION_KEK_PREVIOUS;
    __resetKeyProviderForTests();
  });

  it("covers DevKeyProvider / KmsKeyProvider error paths", async () => {
    expect(
      () =>
        new DevKeyProvider({
          keyVersion: 1,
          currentKek: Buffer.alloc(16),
        }),
    ).toThrow(/32 bytes/);

    const kek = Buffer.alloc(32, 0x33);
    const provider = new DevKeyProvider({ keyVersion: 1, currentKek: kek });
    const wrapped = await provider.wrapDataKey(generateDataKey(), aad("dek"));
    await expect(provider.unwrapDataKey(wrapped, 9, aad("dek", 9))).rejects.toThrow(
      /No KEK registered/,
    );
    await expect(
      provider.unwrapDataKey(Buffer.alloc(4), 1, aad("dek")),
    ).rejects.toThrow(/truncated/);
    const mismatched = Buffer.from(wrapped);
    mismatched.writeUInt32BE(2, 0);
    await expect(
      provider.unwrapDataKey(mismatched, 1, aad("dek")),
    ).rejects.toThrow(/version mismatch/);

    expect(() =>
      new KmsKeyProvider(
        {
          encrypt: async () => ({ ciphertext: new Uint8Array() }),
          decrypt: async () => ({ plaintext: new Uint8Array() }),
        },
        "   ",
        1,
      ),
    ).toThrow(/GCP_KMS_KEY_NAME/);
    const kms = new KmsKeyProvider(
      {
        encrypt: async ({ plaintext }) => ({ ciphertext: plaintext }),
        decrypt: async ({ ciphertext }) => ({ plaintext: ciphertext }),
      },
      "projects/p/locations/l/keyRings/r/cryptoKeys/k",
      1,
    );
    await expect(
      kms.unwrapDataKey(Buffer.from([0, 0, 0, 1]), 1, aad("dek")),
    ).rejects.toThrow(/truncated/);
    const okWrap = await kms.wrapDataKey(generateDataKey(), aad("dek"));
    const badVer = Buffer.from(okWrap);
    badVer.writeUInt32BE(9, 0);
    await expect(kms.unwrapDataKey(badVer, 1, aad("dek"))).rejects.toThrow(
      /version mismatch/,
    );
  });

  it("isEncryptedDocumentData rejects incomplete / malformed packages", () => {
    expect(isEncryptedDocumentData({})).toBe(false);
    expect(
      isMalformedEncryptedDocumentData({
        keyVersion: "1",
        wrappedDataKey: "x",
        titleCipher: { ciphertext: "a", iv: "b", tag: "c" },
        contentCipher: { ciphertext: "a", iv: "b", tag: "c" },
      }),
    ).toBe(true);
    expect(
      isEncryptedDocumentData({
        keyVersion: 1,
        wrappedDataKey: "x",
        titleCipher: null,
        contentCipher: { ciphertext: "a", iv: "b", tag: "c" },
      }),
    ).toBe(false);
    expect(
      encryptAesGcm(
        Buffer.from("buf"),
        generateDataKey(),
        aad("content"),
      ).ciphertext.length,
    ).toBeGreaterThan(0);
  });

  it("length-prefixed AAD includes key version and rejects field swaps", () => {
    const titleAad = buildAad({
      uid: "u",
      docId: "d",
      field: "title",
      keyVersion: 1,
    });
    const contentAad = buildAad({
      uid: "u",
      docId: "d",
      field: "content",
      keyVersion: 1,
    });
    const v2 = buildAad({
      uid: "u",
      docId: "d",
      field: "title",
      keyVersion: 2,
    });
    expect(titleAad.equals(contentAad)).toBe(false);
    expect(titleAad.equals(v2)).toBe(false);
    // uid containing NUL must not collide with docId boundary.
    const withNul = buildAad({
      uid: "a\0b",
      docId: "c",
      field: "title",
      keyVersion: 1,
    });
    const split = buildAad({
      uid: "a",
      docId: "b\0c",
      field: "title",
      keyVersion: 1,
    });
    expect(withNul.equals(split)).toBe(false);
  });
});
