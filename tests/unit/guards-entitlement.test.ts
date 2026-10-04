import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";

const getOptionalSession = vi.fn();
const firestoreGet = vi.fn();

vi.mock("@/features/auth/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/session")>();
  return {
    ...actual,
    getOptionalSession: (...args: unknown[]) => getOptionalSession(...args),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: () => firestoreGet(),
      }),
    }),
  }),
}));

describe("guards entitlement wiring (active only)", () => {
  beforeEach(() => {
    __resetCookieStore();
    getOptionalSession.mockReset();
    firestoreGet.mockReset();
    getOptionalSession.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: Math.floor(Date.now() / 1000),
    });
  });

  it("getAccountState is subscriber only when projection status is active", async () => {
    const { getAccountState } = await import("@/features/auth/guards");

    firestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "active" }),
    });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "subscriber",
      subscriptionActive: true,
    });

    for (const status of ["past_due", "trialing", "canceled", "unpaid", "incomplete"]) {
      firestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({ status }),
      });
      await expect(getAccountState()).resolves.toMatchObject({
        kind: "logged_in",
        subscriptionActive: false,
      });
    }
  });

  it("requireActiveSubscription rejects non-active statuses", async () => {
    const { requireActiveSubscription } = await import("@/features/auth/guards");
    const { SessionError } = await import("@/features/auth/session");

    firestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "past_due" }),
    });
    await expect(requireActiveSubscription("u1")).rejects.toBeInstanceOf(
      SessionError,
    );

    firestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "active" }),
    });
    await expect(requireActiveSubscription("u1")).resolves.toBeUndefined();
  });

  it("treats missing projection, non-string status, and Firestore errors as not subscribed", async () => {
    const { getAccountState } = await import("@/features/auth/guards");

    firestoreGet.mockResolvedValue({ exists: false });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "logged_in",
      subscriptionActive: false,
    });

    firestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 1 }),
    });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "logged_in",
      subscriptionActive: false,
    });

    firestoreGet.mockRejectedValue(new Error("emulator down"));
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "logged_in",
      subscriptionActive: false,
    });
  });

  it("returns logged_out when session lookup throws or returns null", async () => {
    const { getAccountState } = await import("@/features/auth/guards");

    getOptionalSession.mockRejectedValueOnce(new Error("revoked"));
    await expect(getAccountState()).resolves.toEqual({ kind: "logged_out" });

    getOptionalSession.mockResolvedValueOnce(null);
    await expect(getAccountState()).resolves.toEqual({ kind: "logged_out" });
  });

  it("uses empty email when session email is not a string", async () => {
    getOptionalSession.mockResolvedValue({
      uid: "u1",
      email: null,
      auth_time: Math.floor(Date.now() / 1000),
    });
    firestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "active" }),
    });
    const { getAccountState } = await import("@/features/auth/guards");
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "subscriber",
      email: "",
      displayName: null,
    });
  });

  it("reads displayName from the session name claim when present", async () => {
    getOptionalSession.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      name: "  Ada Lovelace  ",
      auth_time: Math.floor(Date.now() / 1000),
    });
    firestoreGet.mockResolvedValue({ exists: false });
    const { getAccountState } = await import("@/features/auth/guards");
    await expect(getAccountState()).resolves.toMatchObject({
      kind: "logged_in",
      displayName: "Ada Lovelace",
      email: "a@example.com",
    });
  });

  it("requireSession throws when there is no session", async () => {
    getOptionalSession.mockResolvedValue(null);
    const { requireSession } = await import("@/features/auth/guards");
    const { SessionError } = await import("@/features/auth/session");
    await expect(requireSession()).rejects.toBeInstanceOf(SessionError);
  });
});
