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

vi.mock("@/lib/firebase/admin", () => ({
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
    expect(payload).not.toHaveProperty("password");
    expect(JSON.stringify(payload)).not.toContain("person@example.com");
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

  it("README security section documents Firebase Auth salted scrypt", () => {
    const readme = readFileSync(
      path.resolve(process.cwd(), "README.md"),
      "utf8",
    );
    const start = readme.indexOf("## Security");
    expect(start).toBeGreaterThan(-1);
    const section = readme.slice(start, start + 2500);
    expect(section).toMatch(/salted scrypt/i);
    expect(section).toMatch(/Firebase Auth/);
    expect(section).toMatch(/envelope/i);
    expect(section).toMatch(/never stores, logs, or sends passwords/i);
  });
});
