import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readme(): string {
  return readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
}

function readDoc(rel: string): string {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
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

const EVALUATOR_DENY =
  /Supervisor|GasNet|Hermes|Cursor Project/;

/** Docs linked from README (write-up is Surfaces-only — one link). */
const MORE_DOCS = [
  "docs/architecture.md",
  "docs/art-direction.md",
  "docs/local-development.md",
  "docs/stripe-testing.md",
  "docs/testing.md",
  "docs/design-notes.md",
  "docs/security.md",
  "docs/ai-usage.md",
] as const;

const ALL_REVIEWER_DOCS = [
  "README.md",
  "docs/write-up.md",
  ...MORE_DOCS,
] as const;

/** Resolve relative markdown / image targets from a source file. */
function collectLocalTargets(sourceRel: string, text: string): string[] {
  const dir = path.dirname(path.resolve(process.cwd(), sourceRel));
  const targets: string[] = [];
  for (const match of text.matchAll(
    /!\[[^\]]*]\(([^)]+)\)|\[[^\]]*]\(([^)]+)\)/g,
  )) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    if (!raw || raw.startsWith("#")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue; // http(s), mailto, …
    const bare = raw.split(/[?#]/)[0]!;
    if (!bare) continue;
    targets.push(path.resolve(dir, bare));
  }
  return targets;
}

describe("README technical sections (evaluator-facing)", () => {
  it("opens with status badges under the title, then pitch and Quick Start", () => {
    const text = readme();
    const titleIdx = text.indexOf("# Prosefield");
    const badgeIdx = text.indexOf("actions/workflows/ci.yml/badge.svg?branch=main");
    const pitchIdx = text.indexOf("A writing workspace");
    const agentIdx = text.indexOf(
      "## Let your agent set up and run this project (locally)",
    );
    const quickIdx = text.indexOf("## Quick start");
    const demoIdx = text.indexOf("## Demo");
    expect(titleIdx).toBe(0);
    expect(badgeIdx).toBeGreaterThan(titleIdx);
    expect(badgeIdx).toBeLessThan(pitchIdx);
    expect(text).toMatch(/coverage_\(statements\)-99\.96%25/);
    expect(text).toMatch(/tests-668%20passed/);
    expect(text).toMatch(/\[!\[vitest]/);
    expect(text).toMatch(/badge\/node-24/);
    expect(text).toMatch(/TypeScript-strict/);
    expect(text).toMatch(/Next\.js-16/);
    expect(text).not.toMatch(/img\.shields\.io\/badge\/[Ll]icense/);
    expect(pitchIdx).toBeGreaterThan(-1);
    expect(agentIdx).toBeGreaterThan(pitchIdx);
    expect(quickIdx).toBeGreaterThan(agentIdx);
    expect(demoIdx).toBeGreaterThan(quickIdx);

    const quickEnd = text.indexOf("## Demo");
    const quick = text.slice(quickIdx, quickEnd);
    expect(quick).toMatch(/bash scripts\/check\.sh/);
    expect(quick).toMatch(/bash scripts\/start\.sh/);
    expect(quick).toMatch(/git clone/);
    // No toolchain jargon in Quick Start (corepack handled by scripts).
    expect(quick).not.toMatch(/corepack/i);
    expect(quick).not.toMatch(/\.nvmrc/);
    expect(quick).toMatch(/WSL2/);
    expect(quick).toMatch(/learn\.microsoft\.com\/en-us\/windows\/wsl\/install/);
    expect(quick).toMatch(/already installed/i);
    expect(quick).toMatch(/Billing is not configured/);
    expect(quick).toMatch(/~\//);

    expect(text).toMatch(/docs\/demo\/01-landing\.gif/);
    expect(text).toMatch(/AGENT_SETUP\.md/);
    // README one-liner: policy lives in AGENT_SETUP.md (no "stop and ask" in the paste).
    expect(text).toMatch(
      /Follow https:\/\/raw\.githubusercontent\.com\/gassius\/prosefield\/main\/AGENT_SETUP\.md end to end\./,
    );
    expect(text).not.toMatch(/Stop and ask me before any system-wide install/);
    expect(text).toMatch(/docs\/local-development\.md/);
  });

  it("keeps architecture and surfaces as short links (no take-home/assignment wording)", () => {
    const text = readme();
    expect(text).toMatch(/## Architecture/);
    expect(text).toMatch(/docs\/architecture\.md/);
    expect(text).toMatch(/## Surfaces/);
    expect(text).toMatch(/docs\/write-up\.md/);
    // Exactly one write-up href (Surfaces); not repeated in More docs.
    expect(text.match(/\]\(docs\/write-up\.md\)/g)?.length).toBe(1);
    expect(text).not.toMatch(/take-home/i);
    expect(text).not.toMatch(/\bassignment\b/i);
    expect(text).not.toMatch(/ClickUp/i);
    expect(text).not.toMatch(/Carlos — confirm before ship/);
    expect(text).not.toMatch(/\bP[0-6]\b/);
    expect(text).not.toMatch(/P5a|P5b/);
    // Bite: reintroducing internal process names fails.
    expect(text).not.toMatch(EVALUATOR_DENY);
    expect(text).not.toMatch(/AGENTS\.md/);
  });

  it("links every More docs entry and each file exists", () => {
    const text = readme();
    expect(text).toMatch(/## More docs/);
    for (const rel of MORE_DOCS) {
      expect(text, `README should link ${rel}`).toMatch(
        new RegExp(rel.replace(/\./g, "\\.")),
      );
      expect(existsSync(path.resolve(process.cwd(), rel)), rel).toBe(true);
    }
    expect(existsSync(path.resolve(process.cwd(), "docs/write-up.md"))).toBe(
      true,
    );
  });

  it("offline: relative links and images in README and linked docs resolve", () => {
    for (const rel of ALL_REVIEWER_DOCS) {
      const text = readDoc(rel);
      for (const target of collectLocalTargets(rel, text)) {
        expect(
          existsSync(target),
          `${rel} → missing ${path.relative(process.cwd(), target)}`,
        ).toBe(true);
      }
    }
  });

  it("manual start and prerequisites live in local-development.md", () => {
    const section = readDoc("docs/local-development.md");
    expect(section).toMatch(/## Manual start \(optional\)/);
    expect(section).toMatch(/## Prerequisites \(details\)/);
    expect(section).toMatch(/nvm install/);
    expect(section).toMatch(/\.nvmrc/);
    expect(section).toMatch(/corepack enable/);
    expect(section).toMatch(/```bash\n\s*pnpm install\n\s*pnpm dev\n\s*```/);
    expect(section).toMatch(/docker compose up -d --wait/);
    expect(section).toMatch(/pnpm backend:up/);
    expect(section).toMatch(/pnpm backend:down/);
    expect(section).toMatch(/pnpm backend:logs/);
    expect(section).toMatch(/do not install the Firebase CLI on the host/i);
    expect(section).toMatch(/no global `firebase-tools`/);
    expect(section).toMatch(/Emulator Suite runtime/);
    expect(section).toMatch(/WSL2 only/i);
    expect(section).toMatch(/## Emulator data/);
    expect(section).toMatch(/## Optional Compose profiles/);
    expect(section).toMatch(/Optional `app` profile notes/);
  });

  it("architecture overview lives in docs/architecture.md with core stack choices", () => {
    const section = readDoc("docs/architecture.md");
    expect(section).toMatch(/### Architecture overview/);
    expect(section).toMatch(/Next\.js 16/);
    expect(section).toMatch(/Firebase Auth/);
    expect(section).toMatch(/Cloud Firestore/);
    expect(section).toMatch(/Stripe Checkout/);
    expect(section).toMatch(/Tiptap/);
    expect(section).toMatch(/Carlos González Rico \(AI-assisted\)/);
    expect(section).toMatch(/## 14\. Build order/);
    expect(section).not.toMatch(/ClickUp/i);
    expect(section).not.toMatch(/\bP[0-6]\b/);
    // Bite: reintroducing internal process names fails.
    expect(section).not.toMatch(EVALUATOR_DENY);
    expect(section).not.toMatch(/Cloud Agent env/);
    // Bite: reintroducing time-box / take-home / graded-project framing fails.
    expect(section).not.toMatch(/time budget/i);
    expect(section).not.toMatch(/hard cap/i);
    expect(section).not.toMatch(/three questions/i);
    expect(section).not.toMatch(/Effort of 6/);
    expect(section).not.toMatch(/\| Est\. \|/);
    expect(section).not.toMatch(/rubric/i);
    expect(readme()).not.toMatch(/rubric/i);
    // Only allowed AGENTS.md mention is the Next.js warn note in §3.
    const agentsHits = [...section.matchAll(/AGENTS\.md/g)];
    expect(agentsHits).toHaveLength(1);
    expect(section).toMatch(/AGENTS\.md warns/);
  });

  it("known limitations and tradeoffs live in design-notes.md", () => {
    const section = readDoc("docs/design-notes.md");
    expect(section).toMatch(/## Known limitations/);
    expect(section).toMatch(/Docker is required/i);
    expect(section).toMatch(/Manual save only/i);
    expect(section).toMatch(/No real-time collaboration/i);
    expect(section).toMatch(/sk_test_/);
    expect(section).toMatch(/FEATURE_CUSTOMER_PORTAL/);
    expect(section).toMatch(/## Tradeoffs and “With another day”/);
    expect(section).toMatch(/512 KiB/);
  });

  it("AI usage lives in ai-usage.md without the confirm-before-ship checklist", () => {
    const section = readDoc("docs/ai-usage.md");
    expect(section).toMatch(/AI usage and manual verification/i);
    expect(section).not.toMatch(/Carlos — confirm before ship/);
    expect(section).not.toMatch(/do not treat as already done/);
    expect(readme()).toMatch(/## Credits/);
    expect(readme()).toMatch(
      /Architecture and implementation: Carlos González Rico, with AI coding agents/,
    );
    expect(readme()).not.toMatch(EVALUATOR_DENY);
    expect(readme()).not.toMatch(/docs\/time-log\.md/);
    expect(readme()).not.toMatch(/docs\/screenshots\//);
  });

  it("Stripe 4242 minimum stays in README and details in stripe-testing.md", () => {
    const text = readme();
    const start = text.indexOf("## Manual Stripe test payment (4242)");
    const end = text.indexOf("## Testing");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);
    expect(section).toMatch(/4242 4242 4242 4242/);
    expect(section).toMatch(
      /docker compose --profile app --profile stripe up/,
    );
    expect(section).toMatch(/pnpm stripe:setup/);
    expect(section).toMatch(/Skip host `pnpm dev`/);
    expect(section).toMatch(/docs\/stripe-testing\.md/);

    const details = readDoc("docs/stripe-testing.md");
    expect(details).toMatch(/Billing is not configured/i);
    expect(details).toMatch(
      /all three of `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`/,
    );
  });

  it("every pnpm <script> mentioned in README and linked docs exists in package.json", () => {
    const scripts = packageScripts();
    // Not package.json scripts — Corepack / pnpm builtins / playwright CLI.
    const allowlist = new Set(["install", "exec", "start"]);
    const corpus = [
      readme(),
      ...ALL_REVIEWER_DOCS.filter((r) => r !== "README.md").map((rel) =>
        readDoc(rel),
      ),
    ].join("\n");
    for (const name of pnpmScriptNames(corpus)) {
      if (allowlist.has(name)) continue;
      expect(
        scripts.has(name),
        `Docs mention \`pnpm ${name}\` but package.json has no such script`,
      ).toBe(true);
    }
  });

  it("security details live in docs/security.md", () => {
    const section = readDoc("docs/security.md");
    expect(section).toMatch(/AES-256-GCM/);
    expect(section).toMatch(/KeyProvider/);
    expect(section).toMatch(/HSTS/);
    expect(section).toMatch(/salted scrypt/i);
    expect(section).not.toMatch(/ClickUp/i);
  });

  it("testing.md documents CI emulator env, ALLOW_EMULATORS, and stripe prices mock", () => {
    const section = readDoc("docs/testing.md");
    expect(section).toMatch(/## Policy/);
    expect(section).toMatch(/Same-PR tests for behaviour changes/);
    expect(section).not.toMatch(/AGENTS\.md/);
    expect(section).toMatch(/FIREBASE_AUTH_EMULATOR_HOST=127\.0\.0\.1:9099/);
    expect(section).toMatch(/FIRESTORE_EMULATOR_HOST=127\.0\.0\.1:8080/);
    expect(section).toMatch(/APP_URL=http:\/\/localhost:3000/);
    expect(section).toMatch(/ALLOW_EMULATORS=1/);
    expect(section).toMatch(/scripts\/stripe-prices-mock-server\.mjs/);
    expect(section).toMatch(/e2e\/visual\.spec\.ts/);
    expect(section).toMatch(/STRIPE_API_HOST/);
  });

  it("art-direction reference images use art-direction/ prefix", () => {
    const section = readDoc("docs/art-direction.md");
    expect(section).toMatch(/art-direction\/prosefield-landing-v1\.1\.png/);
    expect(section).toMatch(
      /art-direction\/prosefield-landing-mobile-v1\.1\.png/,
    );
    expect(section).toMatch(/art-direction\/prosefield-branding-v1\.1\.png/);
    expect(section).not.toMatch(/!\[\]\(prosefield-/);
    expect(section).not.toMatch(/take-home/i);
    expect(section).not.toMatch(/\bassignment\b/i);
  });
});
