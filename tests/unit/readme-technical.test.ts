import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readme(): string {
  return readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
}

describe("README technical sections (P5a)", () => {
  it("quick start uses nvm, host pnpm dev, and Docker Compose backend only", () => {
    const text = readme();
    expect(text).toMatch(/nvm use/);
    expect(text).toMatch(/\.nvmrc/);
    expect(text).toMatch(/pnpm install/);
    expect(text).toMatch(/pnpm dev/);
    expect(text).toMatch(/docker compose up -d --wait/);
    expect(text).toMatch(/do not install the Firebase CLI on the host/i);
    expect(text).toMatch(/no global `firebase-tools`/);
    expect(text).toMatch(/Emulator Suite runtime/);
  });

  it("documents architecture overview with core stack choices", () => {
    const text = readme();
    const start = text.indexOf("## Architecture overview");
    const end = text.indexOf("### Emulator data");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/Next\.js 16/);
    expect(section).toMatch(/Firebase Auth/);
    expect(section).toMatch(/Cloud Firestore/);
    expect(section).toMatch(/Stripe Checkout/);
    expect(section).toMatch(/Tiptap/);
    expect(section).toMatch(/docs\/architecture\.md/);
  });

  it("documents known limitations including Docker-only backend and manual save", () => {
    const text = readme();
    const start = text.indexOf("## Known limitations");
    const end = text.indexOf("## Scripts");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/Docker is required/i);
    expect(section).toMatch(/Manual save only/i);
    expect(section).toMatch(/No real-time collaboration/i);
    expect(section).toMatch(/sk_test_/);
    expect(section).toMatch(/FEATURE_CUSTOMER_PORTAL/);
  });

  it("Stripe 4242 section still points at stripe-cli via Compose", () => {
    const text = readme();
    const start = text.indexOf("### Manual Stripe test payment (4242)");
    const end = text.indexOf("## Known limitations");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/4242 4242 4242 4242/);
    expect(section).toMatch(
      /docker compose --profile app --profile stripe up/,
    );
    expect(section).toMatch(/pnpm stripe:setup/);
  });
});
