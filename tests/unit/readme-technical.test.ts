import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readme(): string {
  return readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
}

function packageScripts(): Set<string> {
  const pkg = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  return new Set(Object.keys(pkg.scripts));
}

/** Collect `pnpm <name>` tokens from fenced blocks and inline backticks. */
function pnpmScriptNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/`pnpm ([a-zA-Z0-9:_-]+)`/g)) {
    names.add(match[1]!);
  }
  for (const match of text.matchAll(/^pnpm ([a-zA-Z0-9:_-]+)/gm)) {
    names.add(match[1]!);
  }
  return [...names];
}

describe("README technical sections (P5a)", () => {
  it("quick start uses nvm install, corepack, host pnpm dev, and Docker Compose backend only", () => {
    const text = readme();
    const start = text.indexOf("## Quick start");
    const end = text.indexOf("## Architecture overview");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/nvm install/);
    expect(section).toMatch(/\.nvmrc/);
    expect(section).toMatch(/corepack enable/);
    // Pin the host frontend fence (not the optional-step prose mention of `pnpm dev`).
    expect(section).toMatch(/```bash\n\s*pnpm install\n\s*pnpm dev\n\s*```/);
    expect(section).toMatch(/docker compose up -d --wait/);
    expect(section).toMatch(/pnpm backend:up/);
    expect(section).toMatch(/pnpm backend:down/);
    expect(section).toMatch(/pnpm backend:logs/);
  });

  it("prerequisites keep Docker-only backend and no host Firebase CLI", () => {
    const text = readme();
    const start = text.indexOf("## Prerequisites");
    const end = text.indexOf("## Quick start");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/do not install the Firebase CLI on the host/i);
    expect(section).toMatch(/no global `firebase-tools`/);
    expect(section).toMatch(/Emulator Suite runtime/);
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

  it("Stripe 4242 section uses Compose app+stripe profiles without host pnpm dev", () => {
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
    expect(section).toMatch(/Skip host `pnpm dev`/);
  });

  it("every pnpm <script> mentioned in README exists in package.json", () => {
    const text = readme();
    const scripts = packageScripts();
    // Not package.json scripts — Corepack / pnpm builtins / playwright CLI.
    const allowlist = new Set(["install", "exec"]);
    for (const name of pnpmScriptNames(text)) {
      if (allowlist.has(name)) continue;
      expect(
        scripts.has(name),
        `README mentions \`pnpm ${name}\` but package.json has no such script`,
      ).toBe(true);
    }
  });
});
