import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE_NAME } from "@/features/auth/constants";

function createCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function isSecureHost(request: NextRequest): boolean {
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

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
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
