import { NextResponse } from "next/server";
import { assertValidOrigin } from "@/features/auth/csrf";
import { requireSession } from "@/features/auth/guards";
import { SessionError } from "@/features/auth/session";
import {
  CheckoutError,
  createCheckoutSession,
} from "@/features/billing/checkout";
import { resolveCheckoutCancelPath } from "@/features/billing/checkout-cancel-path";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

async function readCancelPath(request: Request): Promise<string | undefined> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }
  try {
    const body = (await request.json()) as { cancelPath?: unknown };
    return typeof body.cancelPath === "string" ? body.cancelPath : undefined;
  } catch {
    return undefined;
  }
}

/**
 * POST /api/checkout — create a Stripe Checkout Session and redirect (303).
 * 409 path: redirect to /documents when a non-terminal subscription exists.
 * JSON/fetch clients get 401 when unauthenticated (not 303 to login).
 * Optional JSON body `{ cancelPath }` selects an allow-listed cancel_url.
 */
export async function POST(request: Request) {
  if (!assertValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const env = getEnv();
  const cancelPath = resolveCheckoutCancelPath(await readCancelPath(request));

  try {
    const session = await requireSession({ checkRevoked: true });
    const email = typeof session.email === "string" ? session.email : "";
    const { url } = await createCheckoutSession({
      uid: session.uid,
      email,
      cancelPath,
    });
    if (wantsJson(request)) {
      return NextResponse.json({ url });
    }
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof SessionError) {
      if (wantsJson(request)) {
        return NextResponse.json(
          { error: "Authentication required", code: "unauthorized" },
          { status: 401 },
        );
      }
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent("/subscribe")}`, env.APP_URL),
        303,
      );
    }
    if (error instanceof CheckoutError) {
      if (error.code === "already_active") {
        if (wantsJson(request)) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: 409 },
          );
        }
        return NextResponse.redirect(new URL("/documents", env.APP_URL), 303);
      }
      if (error.code === "not_configured") {
        if (wantsJson(request)) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: 503 },
          );
        }
        return NextResponse.redirect(
          new URL("/subscribe?error=not_configured", env.APP_URL),
          303,
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 502 },
      );
    }
    const { logError } = await import("@/lib/logger");
    logError("[checkout] unexpected error");
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
