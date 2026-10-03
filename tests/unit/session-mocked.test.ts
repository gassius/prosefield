import { beforeEach, describe, expect, it, vi } from "vitest";
import { __getCookieRecord, __resetCookieStore } from "../mocks/next-headers";
import {
  PASSWORD_POLICY_CLAIM,
  PASSWORD_POLICY_CLAIM_VALUE,
  PASSWORD_POLICY_GRANDFATHER_BEFORE_MS,
} from "@/features/auth/constants";

const verifyIdToken = vi.fn();
const createSessionCookie = vi.fn();
const verifySessionCookie = vi.fn();
const revokeRefreshTokens = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken,
    createSessionCookie,
    verifySessionCookie,
    revokeRefreshTokens,
    getUser,
  }),
  getAdminFirestore: () => {
    throw new Error("firestore unused in this suite");
  },
}));

function recentAuthTime() {
  return Math.floor(Date.now() / 1000);
}

describe("session helpers (mocked admin)", () => {
  beforeEach(() => {
    __resetCookieStore();
    vi.clearAllMocks();
    createSessionCookie.mockResolvedValue("session-cookie");
  });

  it("keeps the grandfather cutoff fixed to the gate-land instant", () => {
    // Exact value — mutating the constant must turn this red.
    expect(PASSWORD_POLICY_GRANDFATHER_BEFORE_MS).toBe(
      Date.parse("2026-10-03T20:00:00.000Z"),
    );
  });

  it("rejects ID tokens that are not recently authenticated", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: 1,
      [PASSWORD_POLICY_CLAIM]: PASSWORD_POLICY_CLAIM_VALUE,
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
    expect(getUser).not.toHaveBeenCalled();
    expect(verifyIdToken).toHaveBeenCalledWith("tok", true);
  });

  it("accepts a token with the password-policy claim (post-cutoff)", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: recentAuthTime(),
      [PASSWORD_POLICY_CLAIM]: PASSWORD_POLICY_CLAIM_VALUE,
    });
    const { createSessionCookieFromIdToken } = await import(
      "@/features/auth/session"
    );
    const result = await createSessionCookieFromIdToken("tok");
    expect(result.sessionCookie).toBe("session-cookie");
    expect(result.decoded.uid).toBe("u1");
    expect(getUser).not.toHaveBeenCalled();
    expect(createSessionCookie).toHaveBeenCalledWith("tok", expect.any(Object));
  });

  it("accepts a pre-cutoff account without the claim (grandfather)", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "legacy",
      email: "legacy@example.com",
      auth_time: recentAuthTime(),
    });
    getUser.mockResolvedValue({
      metadata: {
        // Fixed historical creation — bites if cutoff is mutated to 0.
        creationTime: "Fri, 01 Jan 2021 00:00:00 GMT",
      },
    });
    const { createSessionCookieFromIdToken } = await import(
      "@/features/auth/session"
    );
    const result = await createSessionCookieFromIdToken("tok");
    expect(result.decoded.uid).toBe("legacy");
    expect(getUser).toHaveBeenCalledWith("legacy");
    expect(createSessionCookie).toHaveBeenCalled();
  });

  it("rejects a post-cutoff account without the claim", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "new",
      email: "new@example.com",
      auth_time: recentAuthTime(),
    });
    getUser.mockResolvedValue({
      metadata: {
        // Far future vs cutoff — bites if cutoff is widened to MAX / year 2100.
        creationTime: "Thu, 01 Jan 2099 00:00:00 GMT",
      },
    });
    const { createSessionCookieFromIdToken, SessionError } = await import(
      "@/features/auth/session"
    );
    await expect(createSessionCookieFromIdToken("tok")).rejects.toBeInstanceOf(
      SessionError,
    );
    await expect(createSessionCookieFromIdToken("tok")).rejects.toMatchObject({
      code: "unauthorized",
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
    expect(await getOptionalSession()).toBeNull();
    expect(verifySessionCookie).toHaveBeenCalledWith("bad-cookie", true);
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    expect(jar.get(SESSION_COOKIE_NAME)?.value).toBe("bad-cookie");
  });

  it("defaults getOptionalSession to checkRevoked true (copied cookie dies after revoke)", async () => {
    const { setSessionCookie, getOptionalSession } = await import(
      "@/features/auth/session"
    );
    await setSessionCookie("session-cookie");
    verifySessionCookie.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: Math.floor(Date.now() / 1000),
    });
    await getOptionalSession();
    expect(verifySessionCookie).toHaveBeenCalledWith("session-cookie", true);
  });

  it("sets HttpOnly / SameSite=Lax cookie attributes; Secure follows request protocol", async () => {
    const { setSessionCookie, SESSION_COOKIE_NAME, SESSION_EXPIRES_IN_MS } =
      await import("@/features/auth/session");

    await setSessionCookie("sess", new Request("http://localhost:3000/api/session"));
    expect(__getCookieRecord(SESSION_COOKIE_NAME)).toMatchObject({
      value: "sess",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
    });

    await setSessionCookie(
      "sess-secure",
      new Request("https://app.example/api/session"),
    );
    expect(__getCookieRecord(SESSION_COOKIE_NAME)).toMatchObject({
      value: "sess-secure",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    await setSessionCookie(
      "sess-fwd",
      new Request("http://app.example/api/session", {
        headers: { "x-forwarded-proto": "https" },
      }),
    );
    expect(__getCookieRecord(SESSION_COOKIE_NAME)?.secure).toBe(true);
  });

  it("revokes refresh tokens for a uid", async () => {
    revokeRefreshTokens.mockResolvedValue(undefined);
    const { revokeUserSessions } = await import("@/features/auth/session");
    await revokeUserSessions("uid-1");
    expect(revokeRefreshTokens).toHaveBeenCalledWith("uid-1");
  });
});
