import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultStripe,
  resolveStripeFactory,
  seedTestPrice,
} from "@/lib/stripe/seed-test-price";
import {
  FAKE_STRIPE_LIVE_SECRET_KEY,
  FAKE_STRIPE_SECRET_KEY,
} from "../fixtures/stripe";

describe("pnpm stripe:seed .env loading", () => {
  it("stripe:seed script loads .env via tsx --env-file=.env", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["stripe:seed"]).toContain("--env-file=.env");
    expect(pkg.scripts["stripe:seed"]).toContain("scripts/stripe-seed.ts");
  });

  it("stripe:setup script loads .env via tsx --env-file=.env", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["stripe:setup"]).toContain("--env-file=.env");
    expect(pkg.scripts["stripe:setup"]).toContain("scripts/stripe-setup.ts");
  });
});

describe("seedTestPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a product and price with an injected Stripe client (no network)", async () => {
    const productsCreate = vi.fn().mockResolvedValue({
      id: "prod_test1",
      name: "Prosefield",
    });
    const pricesCreate = vi.fn().mockResolvedValue({ id: "price_test1" });
    const createStripe = vi.fn().mockReturnValue({
      products: { create: productsCreate },
      prices: { create: pricesCreate },
    });

    const result = await seedTestPrice(FAKE_STRIPE_SECRET_KEY, {
      createStripe: createStripe as never,
      planDisplayName: "Prosefield",
      planDisplayPrice: "8",
      planDisplayCurrency: "eur",
    });

    expect(result.priceId).toBe("price_test1");
    expect(result.productId).toBe("prod_test1");
    expect(productsCreate).toHaveBeenCalledOnce();
    expect(pricesCreate).toHaveBeenCalledOnce();
  });

  it("rejects live keys before touching Stripe", async () => {
    const createStripe = vi.fn();
    await expect(
      seedTestPrice(FAKE_STRIPE_LIVE_SECRET_KEY, {
        createStripe: createStripe as never,
      }),
    ).rejects.toThrow(/live key/);
    expect(createStripe).not.toHaveBeenCalled();
  });

  it("rejects invalid PLAN_DISPLAY_PRICE before touching Stripe", async () => {
    const createStripe = vi.fn();
    await expect(
      seedTestPrice(FAKE_STRIPE_SECRET_KEY, {
        createStripe: createStripe as never,
        planDisplayPrice: "0",
      }),
    ).rejects.toThrow(/Invalid PLAN_DISPLAY_PRICE/);
    expect(createStripe).not.toHaveBeenCalled();
  });

  it("uses plan display defaults when options are omitted", async () => {
    const productsCreate = vi.fn().mockResolvedValue({
      id: "prod_defaults",
      name: "Prosefield",
    });
    const pricesCreate = vi.fn().mockResolvedValue({ id: "price_defaults" });
    await seedTestPrice(FAKE_STRIPE_SECRET_KEY, {
      createStripe: (() => ({
        products: { create: productsCreate },
        prices: { create: pricesCreate },
      })) as never,
    });
    expect(productsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Prosefield" }),
    );
    expect(pricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        unit_amount: 800,
        currency: "eur",
      }),
    );
  });

  it("falls back to createDefaultStripe when createStripe is omitted", () => {
    const injected = vi.fn();
    expect(resolveStripeFactory(injected)).toBe(injected);
    expect(resolveStripeFactory(undefined)).toBe(createDefaultStripe);
    expect(resolveStripeFactory()).toBe(createDefaultStripe);
  });

  it("createDefaultStripe constructs a Stripe client", () => {
    const client = createDefaultStripe(FAKE_STRIPE_SECRET_KEY);
    expect(client).toBeTruthy();
    expect(typeof client.products.create).toBe("function");
  });
});
