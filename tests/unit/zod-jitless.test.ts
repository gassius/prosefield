import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "@/lib/zod";

const repoRoot = path.resolve(__dirname, "../..");
const srcRoot = path.join(repoRoot, "src");
const zodEntry = path.join(srcRoot, "lib", "zod.ts");

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

describe("zod jitless (CSP)", () => {
  it("enables jitless so Zod never probes with new Function under nonce CSP", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("routes all src Zod imports through @/lib/zod (no bare zod imports)", () => {
    const offenders: string[] = [];
    const bareZod = /from\s+["']zod["']/;
    for (const file of walk(srcRoot)) {
      if (file === zodEntry) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (bareZod.test(source)) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
