import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const srcRoot = path.join(repoRoot, "src");

/** Server paths that must not call console.* directly (use `@/lib/logger`). */
const SERVER_ROOTS = [
  "features",
  "lib",
  "instrumentation.ts",
  "proxy.ts",
] as const;

const ALLOWED = new Set([
  path.join(srcRoot, "lib", "logger.ts"),
]);

const CONSOLE_RE =
  /\bconsole\.(log|error|warn|info|debug|trace|dir|table)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function serverFiles(): string[] {
  const files: string[] = [];
  for (const root of SERVER_ROOTS) {
    const full = path.join(srcRoot, root);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  // App route handlers / server actions.
  const appRoot = path.join(srcRoot, "app");
  for (const file of walk(appRoot)) {
    if (file.endsWith(`${path.sep}route.ts`) || file.endsWith(`${path.sep}actions.ts`)) {
      files.push(file);
    }
  }
  return [...new Set(files)].filter((f) => !ALLOWED.has(f));
}

describe("server code uses redacting logger (no raw console)", () => {
  it("finds no console.* call sites outside src/lib/logger.ts (L1–L7)", () => {
    const offenders: string[] = [];
    for (const file of serverFiles()) {
      const source = readFileSync(file, "utf8");
      if (CONSOLE_RE.test(source)) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
