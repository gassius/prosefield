import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

const requireSession = vi.fn();
const createCheckoutSession = vi.fn();

vi.mock("@/features/auth/csrf", () => ({
  assertValidOrigin: () => true,
}));

vi.mock("@/features/auth/guards", () => ({
  requireSession: () => requireSession(),
}));

vi.mock("@/features/billing/checkout", async () => {
  const actual = await vi.importActual<typeof import("@/features/billing/checkout")>(
    "@/features/billing/checkout",
  );
  return {
    ...actual,
    createCheckoutSession: () => createCheckoutSession(),
  };
});

describe("POST /api/checkout route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns 401 JSON for unauthenticated fetch clients", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const { SessionError } = await import("@/features/auth/session");
    requireSession.mockRejectedValue(
      new SessionError("Authentication required", "unauthorized"),
    );

    const { POST } = await import("@/app/api/checkout/route");
    const response = await POST(
      new Request("http://localhost:3000/api/checkout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          accept: "application/json",
        },
      }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
  });
});
