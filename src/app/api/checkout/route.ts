import { NextResponse } from "next/server";
import { assertValidOrigin } from "@/features/auth/csrf";
import { requireSession } from "@/features/auth/guards";
import { SessionError } from "@/features/auth/session";
import {
  CheckoutError,
  createCheckoutSession,
} from "@/features/billing/checkout";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * POST /api/checkout — create a Stripe Checkout Session and redirect (303).
 * 409 path: redirect to /documents when already active (Architecture §5.4).
 */
export async function POST(request: Request) {
  if (!assertValidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const env = getEnv();

  try {
    const session = await requireSession({ checkRevoked: true });
    const email = typeof session.email === "string" ? session.email : "";
    const { url } = await createCheckoutSession({
      uid: session.uid,
      email,
    });
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json({ url });
    }
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent("/subscribe")}`, env.APP_URL),
        303,
      );
    }
    if (error instanceof CheckoutError) {
      if (error.code === "already_active") {
        // Prefer 409 for programmatic clients; browsers following form POST get redirect.
        const accept = request.headers.get("accept") ?? "";
        if (accept.includes("application/json")) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: 409 },
          );
        }
        return NextResponse.redirect(new URL("/documents", env.APP_URL), 303);
      }
      if (error.code === "not_configured") {
        const accept = request.headers.get("accept") ?? "";
        if (accept.includes("application/json")) {
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
    console.error("[checkout] unexpected error");
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
