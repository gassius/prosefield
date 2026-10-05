import "server-only";

import { timingSafeEqual } from "node:crypto";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "@/features/auth/constants";
import { getEnv } from "@/lib/env";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };

export function readCsrfFromRequest(request: Request): {
  cookieToken: string | undefined;
  headerToken: string | undefined;
} {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = parseCookieValue(cookieHeader, CSRF_COOKIE_NAME);
  const headerToken = request.headers.get(CSRF_HEADER_NAME) ?? undefined;
  return { cookieToken, headerToken };
}

export function parseCookieValue(
  cookieHeader: string,
  name: string,
): string | undefined {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

export function csrfTokensMatch(
  cookieToken: string | undefined,
  submittedToken: string | undefined,
): boolean {
  if (!cookieToken || !submittedToken) {
    return false;
  }
  if (cookieToken.length !== submittedToken.length) {
    return false;
  }
  try {
    return timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(submittedToken),
    );
  } catch {
    return false;
  }
}

export function assertValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  const { APP_URL } = getEnv();
  try {
    return new URL(origin).origin === new URL(APP_URL).origin;
  } catch {
    return false;
  }
}
