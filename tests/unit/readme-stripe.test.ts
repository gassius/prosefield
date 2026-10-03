import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readme(): string {
  return readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
}

describe("README Stripe manual 4242 flow", () => {
  it("documents pnpm stripe:setup before Compose app+stripe (no host pnpm dev)", () => {
    const text = readme();
    const section = text.slice(
      text.indexOf("### Manual Stripe test payment (4242)"),
      text.indexOf("## Scripts"),
    );
    const setupIdx = section.indexOf("pnpm stripe:setup");
    const forwardIdx = section.indexOf(
      "docker compose --profile app --profile stripe up",
    );

    expect(setupIdx).toBeGreaterThan(-1);
    expect(forwardIdx).toBeGreaterThan(setupIdx);
    expect(section).toMatch(/Skip host `pnpm dev`/);
  });

  it("states /subscribe stays not configured until all three Stripe env vars are set", () => {
    const text = readme();
    expect(text).toMatch(/\/subscribe/);
    expect(text).toMatch(/not configured/i);
    expect(text).toMatch(/STRIPE_SECRET_KEY/);
    expect(text).toMatch(/STRIPE_PRICE_ID/);
    expect(text).toMatch(/STRIPE_WEBHOOK_SECRET/);
    expect(text).toMatch(
      /all three of `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`/,
    );
  });

  it("no longer tells readers to only run stripe:seed and paste the price by hand as step 2", () => {
    const text = readme();
    const manualSection = text.slice(
      text.indexOf("### Manual Stripe test payment (4242)"),
      text.indexOf("## Scripts"),
    );
    // Step 2 must be setup, not a bare seed + paste instruction.
    expect(manualSection).toMatch(/2\.\s+Run `pnpm stripe:setup`/);
    expect(manualSection).not.toMatch(
      /2\.\s+Seed a Price:\s*`pnpm stripe:seed`/,
    );
  });
});
