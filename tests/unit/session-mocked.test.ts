import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";

const verifyIdToken = vi.fn();
const createSessionCookie = vi.fn();
const verifySessionCookie = vi.fn();
const revokeRefreshTokens = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken,
    createSessionCookie,
    verifySessionCookie,
    revokeRefreshTokens,
  }),
  getAdminFirestore: () => {
    throw new Error("firestore unused in this suite");
  },
}));

describe("session helpers (mocked admin)", () => {
  beforeEach(() => {
    __resetCookieStore();
    vi.clearAllMocks();
  });

  it("rejects ID tokens that are not recently authenticated", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: 1,
    });
    const { createSessionCookieFromIdToken, SessionError } = await import(
      "@/features/auth/session"
    );
    await expect(createSessionCookieFromIdToken("tok")).rejects.toBeInstanceOf(
      SessionError,
    );
    await expect(createSessionCookieFromIdToken("tok")).rejects.toMatchObject({
      code: "recent_auth_required",
    });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it("returns null from getOptionalSession when verification fails", async () => {
    const {
      setSessionCookie,
      getOptionalSession,
      SESSION_COOKIE_NAME,
    } = await import("@/features/auth/session");
    await setSessionCookie("bad-cookie");
    verifySessionCookie.mockRejectedValue(new Error("invalid"));
    expect(await getOptionalSession(true)).toBeNull();
    expect(verifySessionCookie).toHaveBeenCalledWith("bad-cookie", true);
    // Cookie jar still holds the value until cleared.
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    expect(jar.get(SESSION_COOKIE_NAME)?.value).toBe("bad-cookie");
  });

  it("revokes refresh tokens for a uid", async () => {
    revokeRefreshTokens.mockResolvedValue(undefined);
    const { revokeUserSessions } = await import("@/features/auth/session");
    await revokeUserSessions("uid-1");
    expect(revokeRefreshTokens).toHaveBeenCalledWith("uid-1");
  });
});
