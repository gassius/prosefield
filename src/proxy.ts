import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE_NAME } from "@/features/auth/constants";
import {
  HSTS_HEADER,
  buildContentSecurityPolicy,
  buildStaticSecurityHeaders,
  shouldAllowEmulatorCspOrigins,
  shouldAllowUnsafeEval,
} from "@/lib/security-headers";

function createCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Force Secure cookies in production when APP_URL is https so a missing or
 * spoofed x-forwarded-proto cannot drop the flag.
 */
function isSecureHost(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") {
    try {
      const appUrl = process.env.APP_URL;
      if (appUrl && new URL(appUrl).protocol === "https:") {
        return true;
      }
    } catch {
      // fall through
    }
  }

  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return false;
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function applyStaticSecurityHeaders(response: NextResponse): void {
  for (const header of buildStaticSecurityHeaders()) {
    response.headers.set(header.key, header.value);
  }
  // Keep HSTS explicit so tests can assert the exact value.
  response.headers.set("Strict-Transport-Security", HSTS_HEADER);
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    allowUnsafeEval: shouldAllowUnsafeEval(),
    allowEmulatorOrigins: shouldAllowEmulatorCspOrigins(),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyStaticSecurityHeaders(response);
  response.headers.set("Content-Security-Policy", csp);

  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: createCsrfToken(),
      httpOnly: false,
      secure: isSecureHost(request),
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 24 * 60 * 60,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
