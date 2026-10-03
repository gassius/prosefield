import { describe, expect, it, vi } from "vitest";
import { runStripeSetup, StripeSetupError } from "@/lib/stripe/setup";
import {
  FAKE_STRIPE_LIVE_RESTRICTED_KEY,
  FAKE_STRIPE_LIVE_SECRET_KEY,
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_RESTRICTED_KEY,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
  PLACEHOLDER_STRIPE_PRICE_ID,
} from "../fixtures/stripe";

describe("runStripeSetup", () => {
  it("seeds a price, prints a webhook secret, and writes both into .env without logging secrets", async () => {
    let file = [
      "# local",
      `STRIPE_SECRET_KEY=${FAKE_STRIPE_SECRET_KEY}`,
      `STRIPE_PRICE_ID=${PLACEHOLDER_STRIPE_PRICE_ID}`,
      "APP_URL=http://localhost:3000",
      "",
    ].join("\n");
    const writes: string[] = [];
    const logs: string[] = [];

    await runStripeSetup({
      envFilePath: ".env",
      readFile: () => file,
      writeFile: (_path, contents) => {
        writes.push(contents);
        file = contents;
      },
      seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
      printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      log: (message) => logs.push(message),
    });

    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(file).toContain(`STRIPE_PRICE_ID=${FAKE_STRIPE_PRICE_ID}`);
    expect(file).toContain(`STRIPE_WEBHOOK_SECRET=${FAKE_STRIPE_WEBHOOK_SECRET}`);
    expect(file).toContain(`STRIPE_SECRET_KEY=${FAKE_STRIPE_SECRET_KEY}`);
    expect(file).toContain("# local");
    expect(file).toContain("APP_URL=http://localhost:3000");
    expect(file.match(/STRIPE_PRICE_ID=/g)).toHaveLength(1);
    expect(file.match(/STRIPE_WEBHOOK_SECRET=/g)).toHaveLength(1);

    const joinedLogs = logs.join("\n");
    expect(joinedLogs).not.toContain(FAKE_STRIPE_SECRET_KEY);
    expect(joinedLogs).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
    expect(joinedLogs).toMatch(/STRIPE_PRICE_ID/);
    expect(joinedLogs).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it("fails clearly when STRIPE_SECRET_KEY is missing from .env", async () => {
    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => "APP_URL=http://localhost:3000\n",
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      }),
    ).rejects.toBeInstanceOf(StripeSetupError);

    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => "APP_URL=http://localhost:3000\n",
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      }),
    ).rejects.toThrow(/Missing STRIPE_SECRET_KEY/);
  });

  it("refuses live keys (sk_live_ / rk_live_)", async () => {
    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => `STRIPE_SECRET_KEY=${FAKE_STRIPE_LIVE_SECRET_KEY}\n`,
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      }),
    ).rejects.toThrow(/live key/);

    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => `STRIPE_SECRET_KEY=${FAKE_STRIPE_LIVE_RESTRICTED_KEY}\n`,
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      }),
    ).rejects.toThrow(/live key/);
  });

  it("accepts rk_test_ restricted keys", async () => {
    let file = `STRIPE_SECRET_KEY=${FAKE_STRIPE_RESTRICTED_KEY}\n`;
    await runStripeSetup({
      envFilePath: ".env",
      readFile: () => file,
      writeFile: (_path, contents) => {
        file = contents;
      },
      seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
      printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
    });
    expect(file).toContain(`STRIPE_PRICE_ID=${FAKE_STRIPE_PRICE_ID}`);
    expect(file).toContain(`STRIPE_WEBHOOK_SECRET=${FAKE_STRIPE_WEBHOOK_SECRET}`);
  });

  it("fails clearly when the .env file is missing", async () => {
    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => {
          throw new Error("ENOENT");
        },
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => FAKE_STRIPE_WEBHOOK_SECRET,
      }),
    ).rejects.toThrow(/Missing \.env/);
  });

  it("fails when stripe-cli does not return a whsec_ secret", async () => {
    await expect(
      runStripeSetup({
        envFilePath: ".env",
        readFile: () => `STRIPE_SECRET_KEY=${FAKE_STRIPE_SECRET_KEY}\n`,
        writeFile: vi.fn(),
        seedPriceId: async () => FAKE_STRIPE_PRICE_ID,
        printWebhookSecret: async () => "not-a-secret",
      }),
    ).rejects.toThrow(/whsec_/);
  });
});
