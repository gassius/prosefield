import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  COVERAGE_FLOOR,
  DIFF_COVERAGE_THRESHOLD,
  compareToBaseline,
  diffCoverageStats,
  evaluateDiffCoverage,
  parseAddedLinesFromDiff,
  parseMetricMap,
  ratchetBaseline,
  totalsFromSummary,
} from "../../scripts/coverage-metrics.mjs";

const root = process.cwd();
const junk: string[] = [];

afterEach(() => {
  while (junk.length) {
    const dir = junk.pop();
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("coverage-metrics (ratchet + diff)", () => {
  it("exports a 90% floor and diff threshold", () => {
    expect(COVERAGE_FLOOR).toBe(90);
    expect(DIFF_COVERAGE_THRESHOLD).toBe(90);
  });

  it("parses coverage-summary totals", () => {
    const totals = totalsFromSummary({
      total: {
        lines: { pct: 99.5 },
        statements: { pct: 99.4 },
        functions: { pct: 100 },
        branches: { pct: 98.1 },
      },
    });
    expect(totals).toEqual({
      lines: 99.5,
      statements: 99.4,
      functions: 100,
      branches: 98.1,
    });
  });

  it("rejects a baseline below the floor", () => {
    const measured = {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    };
    const baseline = parseMetricMap(
      { statements: 80, branches: 90, functions: 90, lines: 90 },
      "fixture",
    );
    const { ok, failures } = compareToBaseline(measured, baseline);
    expect(ok).toBe(false);
    expect(failures.some((f) => f.includes("below floor"))).toBe(true);
  });

  it("fails when measured drops below baseline (ratchet bites)", () => {
    const measured = {
      statements: 91,
      branches: 91,
      functions: 91,
      lines: 91,
    };
    const baseline = {
      statements: 92,
      branches: 90,
      functions: 90,
      lines: 90,
    };
    const { ok, failures } = compareToBaseline(measured, baseline);
    expect(ok).toBe(false);
    expect(failures.join("\n")).toMatch(/statements:.*below baseline 92/);
  });

  it("passes when measured meets floor and baseline", () => {
    const measured = {
      statements: 95,
      branches: 94,
      functions: 100,
      lines: 95,
    };
    const baseline = {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    };
    expect(compareToBaseline(measured, baseline).ok).toBe(true);
  });

  it("ratchetBaseline only moves metrics up", () => {
    const measured = {
      statements: 96,
      branches: 88,
      functions: 100,
      lines: 95,
    };
    const baseline = {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    };
    const { next, raised } = ratchetBaseline(measured, baseline);
    expect(next.statements).toBe(96);
    expect(next.branches).toBe(90); // measured below baseline → keep baseline
    expect(next.functions).toBe(100);
    expect(next.lines).toBe(95);
    expect(raised.join("\n")).toMatch(/statements: 90 → 96/);
    expect(raised.join("\n")).not.toMatch(/branches/);
  });

  it("parseAddedLinesFromDiff tracks + lines under src/", () => {
    const diff = [
      "diff --git a/src/lib/utils.ts b/src/lib/utils.ts",
      "--- a/src/lib/utils.ts",
      "+++ b/src/lib/utils.ts",
      "@@ -10,0 +11,2 @@",
      "+export const a = 1;",
      "+export const b = 2;",
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,0 +2 @@",
      "+ignore me",
    ].join("\n");
    const map = parseAddedLinesFromDiff(diff);
    expect([...map.get("src/lib/utils.ts")!].sort((a, b) => a - b)).toEqual([
      11, 12,
    ]);
    expect(map.get("README.md")?.has(2)).toBe(true);
  });

  it("diffCoverageStats ignores non-src and non-instrumented lines", () => {
    const added = new Map<string, Set<number>>([
      ["src/lib/utils.ts", new Set([11, 12, 13])],
      ["README.md", new Set([2])],
    ]);
    const coverageFinal = {
      "/workspace/src/lib/utils.ts": {
        statementMap: {
          "0": { start: { line: 11 }, end: { line: 11 } },
          "1": { start: { line: 12 }, end: { line: 12 } },
        },
        s: { "0": 1, "1": 0 },
      },
    };
    const stats = diffCoverageStats(added, coverageFinal);
    expect(stats.instrumented).toBe(2);
    expect(stats.covered).toBe(1);
    expect(stats.pct).toBe(50);
    expect(stats.uncovered).toEqual([{ file: "src/lib/utils.ts", line: 12 }]);
  });

  it("evaluateDiffCoverage skips when nothing instrumented; fails under bar", () => {
    expect(evaluateDiffCoverage(null).ok).toBe(true);
    expect(evaluateDiffCoverage(90).ok).toBe(true);
    expect(evaluateDiffCoverage(89.9).ok).toBe(false);
  });
});

describe("check-coverage-ratchet.mjs CLI", () => {
  it("exits 0 when summary meets baseline; exits 1 when below", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cov-ratchet-"));
    junk.push(dir);
    const coverageDir = path.join(dir, "coverage");
    mkdirSync(coverageDir);

    writeFileSync(
      path.join(dir, "coverage-baseline.json"),
      JSON.stringify({
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      }),
    );
    writeFileSync(
      path.join(coverageDir, "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 95 },
          branches: { pct: 94 },
          functions: { pct: 100 },
          lines: { pct: 95 },
        },
      }),
    );

    const script = path.join(root, "scripts/check-coverage-ratchet.mjs");
    const ok = execFileSync("node", [script], {
      cwd: dir,
      encoding: "utf8",
    });
    expect(ok).toMatch(/ok: coverage meets floor and baseline/);

    writeFileSync(
      path.join(coverageDir, "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 89 },
          branches: { pct: 94 },
          functions: { pct: 100 },
          lines: { pct: 95 },
        },
      }),
    );
    expect(() =>
      execFileSync("node", [script], { cwd: dir, encoding: "utf8" }),
    ).toThrow();
  });

  it("--update raises baseline and never lowers it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cov-ratchet-up-"));
    junk.push(dir);
    mkdirSync(path.join(dir, "coverage"));

    const baselinePath = path.join(dir, "coverage-baseline.json");
    writeFileSync(
      baselinePath,
      JSON.stringify({
        statements: 90,
        branches: 92,
        functions: 90,
        lines: 90,
      }),
    );
    writeFileSync(
      path.join(dir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 96 },
          branches: { pct: 93 },
          functions: { pct: 99 },
          lines: { pct: 95 },
        },
      }),
    );

    const script = path.join(root, "scripts/check-coverage-ratchet.mjs");
    execFileSync("node", [script, "--update"], {
      cwd: dir,
      encoding: "utf8",
    });
    const next = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<
      string,
      number
    >;
    expect(next.statements).toBe(96);
    expect(next.branches).toBe(93);
    expect(next.functions).toBe(99);
    expect(next.lines).toBe(95);

    // Measured drop on one metric: --update must not rewrite the baseline down.
    writeFileSync(
      path.join(dir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 96 },
          branches: { pct: 91 },
          functions: { pct: 99 },
          lines: { pct: 95 },
        },
      }),
    );
    expect(() =>
      execFileSync("node", [script, "--update"], {
        cwd: dir,
        encoding: "utf8",
      }),
    ).toThrow();
    const unchanged = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<
      string,
      number
    >;
    expect(unchanged.branches).toBe(93);
  });
});

describe("coverage policy wiring", () => {
  it("vitest global floor is 90 and critical paths keep high bars", () => {
    const config = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
    expect(config).toMatch(/lines:\s*90/);
    expect(config).toMatch(/functions:\s*90/);
    expect(config).toMatch(/branches:\s*90/);
    expect(config).toMatch(/statements:\s*90/);
    expect(config).toMatch(/src\/features\/auth\//);
    expect(config).toMatch(/src\/features\/billing\//);
    expect(config).toMatch(/src\/lib\/crypto\//);
    expect(config).toMatch(/src\/lib\/stripe\//);
    expect(config).toMatch(/src\/features\/documents\/repository/);
    // Non-critical lib bars removed from thresholds object.
    expect(config).not.toMatch(/"src\/lib\/env\.ts"/);
    expect(config).not.toMatch(/"src\/lib\/motion\.ts"/);
    expect(config).toMatch(/"json"/);
  });

  it("committed baseline starts at the 90% floor", () => {
    const baseline = JSON.parse(
      readFileSync(path.join(root, "coverage-baseline.json"), "utf8"),
    ) as Record<string, number>;
    expect(baseline).toEqual({
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    });
  });

  it("Component + coverage job runs ratchet and PR diff coverage", () => {
    const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/name: Component \+ coverage/);
    expect(ci).toMatch(/pnpm coverage:ratchet/);
    expect(ci).toMatch(/pnpm coverage:diff/);
    expect(ci).toMatch(/COVERAGE_DIFF_BASE/);
    expect(ci).toMatch(/fetch-depth:\s*0/);
    // Job name must stay exactly as branch protection expects.
    expect(ci).toMatch(/name: Component \+ coverage/);
  });

  it("package.json exposes coverage scripts", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["coverage:ratchet"]).toMatch(
      /check-coverage-ratchet\.mjs/,
    );
    expect(pkg.scripts["coverage:ratchet:update"]).toMatch(/--update/);
    expect(pkg.scripts["coverage:diff"]).toMatch(/check-coverage-diff\.mjs/);
  });
});
