import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assembleLocalDevEncryptionKek } from "@/lib/env";

const txSet = vi.fn();
const txGet = vi.fn();
const runTransaction = vi.fn(
  async (fn: (tx: { get: typeof txGet; set: typeof txSet }) => Promise<unknown>) =>
    fn({ get: txGet, set: txSet }),
);
const createUser = vi.fn();
const setCustomUserClaims = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    createUser: (...args: unknown[]) => createUser(...args),
    setCustomUserClaims: (...args: unknown[]) => setCustomUserClaims(...args),
  }),
  getAdminFirestore: () => ({
    runTransaction: (
      fn: (tx: { get: typeof txGet; set: typeof txSet }) => Promise<unknown>,
    ) => runTransaction(fn),
    collection: () => ({
      doc: () => ({
        get: vi.fn(),
      }),
    }),
  }),
}));

describe("passwords never leave Firebase Auth", () => {
  beforeEach(() => {
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "1";
    txSet.mockReset();
    txGet.mockReset();
    runTransaction.mockClear();
    createUser.mockReset();
    setCustomUserClaims.mockReset();
    vi.resetModules();
  });

  it("upsertUserDocument never writes password or plaintext email", async () => {
    txGet.mockResolvedValue({ exists: false, data: () => undefined });
    const { upsertUserDocument } = await import("@/features/auth/users");
    await upsertUserDocument({
      uid: "uid-1",
      email: "person@example.com",
    });
    expect(txSet).toHaveBeenCalled();
    const payload = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain("person@example.com");
    expect(JSON.stringify(payload)).not.toMatch(/"password"\s*:\s*"/);
    expect(payload.stripeCustomerId).toBeNull();
  });

  it("register action only passes password to Admin Auth createUser", async () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/features/auth/register.ts"),
      "utf8",
    );
    expect(source).toMatch(/createUser\(/);
    expect(source).toMatch(/password: parsed\.data\.password/);
    expect(source).not.toMatch(/collection\(["']users["']\)/);
    expect(source).not.toMatch(/console\.(log|info|debug|error).*password/i);
  });

  it("behavioural: register canary password never hits console or Firestore writes", async () => {
    const canary = `canary-pw-${Date.now()}-Xy9!`;
    createUser.mockResolvedValue({ uid: "uid-canary" });
    setCustomUserClaims.mockResolvedValue(undefined);

    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { registerAction } = await import("@/features/auth/register");
    const result = await registerAction({
      email: "canary@example.com",
      password: canary,
    });
    expect(result.ok).toBe(true);
    expect(createUser).toHaveBeenCalledWith({
      email: "canary@example.com",
      password: canary,
    });
    expect(txSet).not.toHaveBeenCalled();

    for (const spy of [logSpy, infoSpy, warnSpy, logLogSpy]) {
      for (const args of spy.mock.calls) {
        expect(JSON.stringify(args)).not.toContain(canary);
      }
    }

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    logLogSpy.mockRestore();
  });

  it("docs/security.md documents Firebase Auth salted scrypt", () => {
    const security = readFileSync(
      path.resolve(process.cwd(), "docs/security.md"),
      "utf8",
    );
    expect(security).toMatch(/salted scrypt/i);
    expect(security).toMatch(/Firebase Auth/);
    expect(security).toMatch(/envelope/i);
    expect(security).toMatch(/never stores, logs, or sends passwords/i);
  });
});

