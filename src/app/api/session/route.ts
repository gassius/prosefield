import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertValidOrigin,
  csrfTokensMatch,
  readCsrfFromRequest,
} from "@/features/auth/csrf";
import {
  clearSessionCookie,
  createSessionCookieFromIdToken,
  getOptionalSession,
  revokeUserSessions,
  SessionError,
  setSessionCookie,
} from "@/features/auth/session";
import { upsertUserDocument } from "@/features/auth/users";

const postBodySchema = z.object({
  idToken: z.string().trim().min(1),
});

export async function POST(request: Request) {
  if (!assertValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const { cookieToken, headerToken } = readCsrfFromRequest(request);
  if (!csrfTokensMatch(cookieToken, headerToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  try {
    const { sessionCookie, decoded } = await createSessionCookieFromIdToken(
      parsed.data.idToken,
    );

    const email =
      typeof decoded.email === "string" ? decoded.email : "";

    await upsertUserDocument({ uid: decoded.uid, email });
    await setSessionCookie(sessionCookie, request);

    return NextResponse.json({
      ok: true,
      uid: decoded.uid,
      email,
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  if (!assertValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const { cookieToken, headerToken } = readCsrfFromRequest(request);
  if (!csrfTokensMatch(cookieToken, headerToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const session = await getOptionalSession(true);
  await clearSessionCookie(request);

  if (session?.uid) {
    try {
      await revokeUserSessions(session.uid);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "unknown";
      const { logError } = await import("@/lib/logger");
      logError("[session] revokeRefreshTokens failed", { code });
    }
  }

  return NextResponse.json({ ok: true });
}
