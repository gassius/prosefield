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
  DIFF_COVERAGE_TYPE_ONLY_ALLOWLIST,
  compareCoverageGlobs,
  compareToBaseline,
  diffCoverageStats,
  evaluateDiffCoverage,
  extractCoverageGlobList,
  findAddedIgnorePragmas,
  mergeBaselines,
  missingCoverageEntries,
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

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
}

function initRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cov-git-"));
  junk.push(dir);
  git(dir, ["init"]);
  git(dir, ["checkout", "-b", "main"]);
  return dir;
}

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

  it("mergeBaselines takes the higher value and reports PR lowers", () => {
    const pr = {
      statements: 90,
      branches: 99,
      functions: 100,
      lines: 90,
    };
    const base = {
      statements: 99.82,
      branches: 99.14,
      functions: 100,
      lines: 99.82,
    };
    const { effective, lowered } = mergeBaselines(pr, base);
    expect(effective.statements).toBe(99.82);
    expect(effective.branches).toBe(99.14);
    expect(effective.lines).toBe(99.82);
    expect(lowered.join("\n")).toMatch(/statements:.*below base/);
    expect(lowered.join("\n")).toMatch(/lines:.*below base/);
    expect(mergeBaselines(pr, null).lowered).toEqual([]);
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

  it("diffCoverageStats reports missing coverage entries and uncovered lines", () => {
    const added = new Map<string, Set<number>>([
      ["src/lib/utils.ts", new Set([11, 12, 13])],
      ["src/app/page.tsx", new Set([1])],
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
    expect(stats.missingCoverage).toEqual(["src/app/page.tsx"]);
  });

  it("missingCoverageEntries allowlists type-only paths only", () => {
    const coverageFinal = {
      "/workspace/src/lib/utils.ts": { statementMap: {}, s: {} },
    };
    const missing = missingCoverageEntries(
      [
        "src/lib/utils.ts",
        "src/lib/crypto/types.ts",
        "src/app/page.tsx",
        "README.md",
      ],
      coverageFinal,
    );
    expect(missing).toEqual(["src/app/page.tsx"]);
    expect(DIFF_COVERAGE_TYPE_ONLY_ALLOWLIST.has("src/lib/crypto/types.ts")).toBe(
      true,
    );
  });

  it("findAddedIgnorePragmas catches istanbul and v8 ignore comments", () => {
    const diff = [
      "diff --git a/src/lib/utils.ts b/src/lib/utils.ts",
      "--- a/src/lib/utils.ts",
      "+++ b/src/lib/utils.ts",
      "@@ -1,0 +2,2 @@",
      "+/* istanbul ignore next */",
      "+const x = 1; /* v8 ignore next */",
    ].join("\n");
    const hits = findAddedIgnorePragmas(diff);
    expect(hits).toHaveLength(2);
    expect(hits[0]?.file).toBe("src/lib/utils.ts");
  });

  it("compareCoverageGlobs fails when include is removed or exclude is added", () => {
    const base = `
      coverage: {
        include: ["src/lib/**/*.ts", "src/features/auth/**/*.ts"],
        exclude: ["src/lib/crypto/types.ts"],
      }
    `;
    const narrowed = `
      coverage: {
        include: ["src/lib/**/*.ts"],
        exclude: ["src/lib/crypto/types.ts", "src/lib/firebase/client.ts"],
      }
    `;
    const result = compareCoverageGlobs(base, narrowed);
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/include narrowed/);
    expect(result.failures.join("\n")).toMatch(/exclude narrowed/);
    expect(compareCoverageGlobs(base, base).ok).toBe(true);
    expect(
      extractCoverageGlobList(base, "include"),
    ).toEqual(["src/lib/**/*.ts", "src/features/auth/**/*.ts"]);
  });

  it("evaluateDiffCoverage fails under bar; vacuous ok only without requireInstrumented", () => {
    expect(evaluateDiffCoverage(null).ok).toBe(true);
    expect(evaluateDiffCoverage(null, 90, { requireInstrumented: true }).ok).toBe(
      false,
    );
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

  it("fails when PR baseline is lowered below COVERAGE_RATCHET_BASE", () => {
    const dir = initRepo();
    mkdirSync(path.join(dir, "coverage"));

    writeFileSync(
      path.join(dir, "coverage-baseline.json"),
      JSON.stringify({
        statements: 99.82,
        branches: 99.14,
        functions: 100,
        lines: 99.82,
      }),
    );
    writeFileSync(
      path.join(dir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 99.82 },
          branches: { pct: 99.14 },
          functions: { pct: 100 },
          lines: { pct: 99.82 },
        },
      }),
    );
    git(dir, ["add", "coverage-baseline.json"]);
    git(dir, ["commit", "-m", "base baseline"]);
    const baseSha = git(dir, ["rev-parse", "HEAD"]).trim();

    writeFileSync(
      path.join(dir, "coverage-baseline.json"),
      JSON.stringify({
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      }),
    );
    // Measured still high — only the committed baseline was lowered.
    writeFileSync(
      path.join(dir, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          statements: { pct: 99.82 },
          branches: { pct: 99.14 },
          functions: { pct: 100 },
          lines: { pct: 99.82 },
        },
      }),
    );

    const script = path.join(root, "scripts/check-coverage-ratchet.mjs");
    try {
      execFileSync("node", [script], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, COVERAGE_RATCHET_BASE: baseSha },
      });
      expect.unreachable("expected lowered baseline to fail");
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      expect(e.status).not.toBe(0);
      expect(out).toMatch(/cannot lower coverage-baseline\.json/);
      expect(out).toMatch(/statements:.*below base/);
    }
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

describe("check-coverage-diff.mjs CLI", () => {
  function writePassingCoverage(dir: string, fileKey: string) {
    mkdirSync(path.join(dir, "coverage"), { recursive: true });
    writeFileSync(
      path.join(dir, "coverage", "coverage-final.json"),
      JSON.stringify({
        [fileKey]: {
          statementMap: {
            "0": { start: { line: 1 }, end: { line: 1 } },
          },
          s: { "0": 1 },
        },
      }),
    );
  }

  it("fails when COVERAGE_DIFF_BASE is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cov-diff-nobase-"));
    junk.push(dir);
    writePassingCoverage(dir, "src/lib/utils.ts");
    const script = path.join(root, "scripts/check-coverage-diff.mjs");
    try {
      execFileSync("node", [script], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, COVERAGE_DIFF_BASE: "" },
      });
      expect.unreachable("expected missing base to fail");
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      expect(e.status).not.toBe(0);
      expect(`${e.stdout ?? ""}${e.stderr ?? ""}`).toMatch(
        /COVERAGE_DIFF_BASE is required/,
      );
    }
  });

  it("fails when changed src file is excluded from coverage-final", () => {
    const dir = initRepo();
    mkdirSync(path.join(dir, "src/lib"), { recursive: true });
    writeFileSync(path.join(dir, "src/lib/utils.ts"), "export const a = 1;\n");
    writeFileSync(
      path.join(dir, "vitest.config.ts"),
      `export default { test: { coverage: { include: ["src/lib/**/*.ts"], exclude: [] } } };\n`,
    );
    writePassingCoverage(dir, path.join(dir, "src/lib/utils.ts"));
    git(dir, ["add", "."]);
    git(dir, ["commit", "-m", "base"]);
    const baseSha = git(dir, ["rev-parse", "HEAD"]).trim();

    mkdirSync(path.join(dir, "src/app"), { recursive: true });
    writeFileSync(path.join(dir, "src/app/page.tsx"), "export default function Page() { return null; }\n");
    // coverage-final still only has utils — page is "excluded"/missing.
    writePassingCoverage(dir, path.join(dir, "src/lib/utils.ts"));
    git(dir, ["add", "."]);
    git(dir, ["commit", "-m", "add uncovered page"]);

    const script = path.join(root, "scripts/check-coverage-diff.mjs");
    try {
      execFileSync("node", [script], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, COVERAGE_DIFF_BASE: baseSha },
      });
      expect.unreachable("expected missing coverage entry to fail");
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      expect(e.status).not.toBe(0);
      expect(out).toMatch(/src\/app\/page\.tsx/);
      expect(out).toMatch(/no coverage-final entry/);
    }
  });

  it("fails when instrumented diff coverage is below 90%", () => {
    const dir = initRepo();
    mkdirSync(path.join(dir, "src/lib"), { recursive: true });
    writeFileSync(path.join(dir, "src/lib/utils.ts"), "export const a = 1;\n");
    writeFileSync(
      path.join(dir, "vitest.config.ts"),
      `export default { test: { coverage: { include: ["src/lib/**/*.ts"], exclude: [] } } };\n`,
    );
    git(dir, ["add", "."]);
    git(dir, ["commit", "-m", "base"]);
    const baseSha = git(dir, ["rev-parse", "HEAD"]).trim();

    writeFileSync(
      path.join(dir, "src/lib/utils.ts"),
      "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n",
    );
    mkdirSync(path.join(dir, "coverage"), { recursive: true });
    writeFileSync(
      path.join(dir, "coverage", "coverage-final.json"),
      JSON.stringify({
        [path.join(dir, "src/lib/utils.ts")]: {
          statementMap: {
            "0": { start: { line: 1 }, end: { line: 1 } },
            "1": { start: { line: 2 }, end: { line: 2 } },
            "2": { start: { line: 3 }, end: { line: 3 } },
          },
          // Only 1 of 3 new-ish lines hit → below 90% for lines 2-3 added.
          s: { "0": 1, "1": 0, "2": 0 },
        },
      }),
    );
    git(dir, ["add", "src/lib/utils.ts"]);
    git(dir, ["commit", "-m", "add uncovered lines"]);

    const script = path.join(root, "scripts/check-coverage-diff.mjs");
    try {
      execFileSync("node", [script], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, COVERAGE_DIFF_BASE: baseSha },
      });
      expect.unreachable("expected low diff coverage to fail");
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      expect(e.status).not.toBe(0);
      expect(out).toMatch(/diff coverage .* below 90%/);
    }
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
    expect(config).not.toMatch(/"src\/lib\/env\.ts"/);
    expect(config).not.toMatch(/"src\/lib\/motion\.ts"/);
    expect(config).toMatch(/"json"/);
  });

  it("committed baseline matches measured main totals (not the 90% floor)", () => {
    const baseline = JSON.parse(
      readFileSync(path.join(root, "coverage-baseline.json"), "utf8"),
    ) as Record<string, number>;
    expect(baseline.statements).toBeGreaterThanOrEqual(99);
    expect(baseline.branches).toBeGreaterThanOrEqual(99);
    expect(baseline.functions).toBe(100);
    expect(baseline.lines).toBeGreaterThanOrEqual(99);
    expect(baseline).toEqual({
      statements: 99.82,
      branches: 99.14,
      functions: 100,
      lines: 99.82,
    });
  });

  it("Component + coverage job runs ratchet with base pin and PR diff coverage", () => {
    const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/name: Component \+ coverage/);
    expect(ci).toMatch(/pnpm coverage:ratchet/);
    expect(ci).toMatch(/COVERAGE_RATCHET_BASE/);
    expect(ci).toMatch(/pnpm coverage:diff/);
    expect(ci).toMatch(/COVERAGE_DIFF_BASE/);
    expect(ci).toMatch(/fetch-depth:\s*0/);
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
