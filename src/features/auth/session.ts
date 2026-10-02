import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
} from "@/features/auth/constants";
import { isRecentAuthTime } from "@/features/auth/auth-time";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getEnv } from "@/lib/env";

export { SESSION_COOKIE_NAME, SESSION_EXPIRES_IN_MS };
export { isRecentAuthTime } from "@/features/auth/auth-time";

export class SessionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unauthorized"
      | "forbidden"
      | "recent_auth_required"
      | "invalid_token",
  ) {
    super(message);
    this.name = "SessionError";
  }
}

function isSecureRequest(): boolean {
  const { APP_URL } = getEnv();
  try {
    const url = new URL(APP_URL);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return false;
    }
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createSessionCookieFromIdToken(
  idToken: string,
): Promise<{ sessionCookie: string; decoded: DecodedIdToken }> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);

  if (!isRecentAuthTime(decoded.auth_time)) {
    throw new SessionError(
      "Recent sign-in required",
      "recent_auth_required",
    );
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  return { sessionCookie, decoded };
}

export async function setSessionCookie(sessionCookie: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: isSecureRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value;
}

export async function verifySessionCookieValue(
  sessionCookie: string,
  checkRevoked = false,
): Promise<DecodedIdToken> {
  return getAdminAuth().verifySessionCookie(sessionCookie, checkRevoked);
}

export async function revokeUserSessions(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid);
}

export async function getOptionalSession(
  checkRevoked = false,
): Promise<DecodedIdToken | null> {
  const sessionCookie = await readSessionCookie();
  if (!sessionCookie) {
    return null;
  }
  try {
    return await verifySessionCookieValue(sessionCookie, checkRevoked);
  } catch {
    return null;
  }
}
