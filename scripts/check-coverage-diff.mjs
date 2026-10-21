#!/usr/bin/env node
/**
 * Diff coverage for new/changed instrumented lines under src/.
 *
 * Usage:
 *   COVERAGE_DIFF_BASE=<sha-or-ref> node scripts/check-coverage-diff.mjs
 *
 * Expects `coverage/coverage-final.json` from `pnpm test:coverage` (json reporter).
 * On PRs, CI sets COVERAGE_DIFF_BASE to the pull_request base SHA.
 *
 * Also fails when:
 * - a changed src/ TypeScript file has no coverage-final entry (except the
 *   explicit type-only allowlist);
 * - the diff adds istanbul/v8 ignore pragmas;
 * - vitest.config.ts coverage include/exclude is narrowed vs the base.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DIFF_COVERAGE_THRESHOLD,
  compareCoverageGlobs,
  diffCoverageStats,
  evaluateDiffCoverage,
  findAddedIgnorePragmas,
  missingCoverageEntries,
  parseAddedLinesFromDiff,
} from "./coverage-metrics.mjs";

const root = process.cwd();
const finalPath = path.join(root, "coverage", "coverage-final.json");
const base = process.env.COVERAGE_DIFF_BASE?.trim();

if (!base) {
  console.error(
    "::error::COVERAGE_DIFF_BASE is required (git ref/SHA of the merge base).",
  );
  process.exit(1);
}

function loadJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`::error::Failed to read ${label} (${filePath}): ${message}`);
    process.exit(1);
  }
}

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    cwd: root,
    maxBuffer: 32 * 1024 * 1024,
  });
}

let diffText;
let changedSrcFiles;
try {
  diffText = git([
    "diff",
    "-U0",
    "--diff-filter=ACMR",
    `${base}...HEAD`,
    "--",
    "src/",
  ]);
  changedSrcFiles = git([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    `${base}...HEAD`,
    "--",
    "src/",
  ])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`::error::git diff failed against ${base}: ${message}`);
  process.exit(1);
}

/** @type {string[]} */
const failures = [];

const ignorePragmas = findAddedIgnorePragmas(diffText);
for (const { file, text } of ignorePragmas) {
  failures.push(`${file}: added coverage-ignore pragma: ${text}`);
}

let baseVitest = "";
let headVitest = "";
try {
  baseVitest = git(["show", `${base}:vitest.config.ts`]);
} catch {
  baseVitest = "";
}
try {
  headVitest = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  failures.push(`failed to read vitest.config.ts: ${message}`);
}
if (baseVitest && headVitest) {
  const globCheck = compareCoverageGlobs(baseVitest, headVitest);
  failures.push(...globCheck.failures);
}

const coverageFinal = loadJson(finalPath, "coverage-final.json");
const missing = missingCoverageEntries(changedSrcFiles, coverageFinal);
for (const file of missing) {
  failures.push(
    `${file}: changed src file has no coverage-final entry (add to include, or to the type-only allowlist if intentional)`,
  );
}

const addedByFile = parseAddedLinesFromDiff(diffText);
const stats = diffCoverageStats(addedByFile, coverageFinal);
const verdict = evaluateDiffCoverage(stats.pct, DIFF_COVERAGE_THRESHOLD);

console.log(
  `Diff coverage base=${base}: instrumented=${stats.instrumented} covered=${stats.covered} pct=${stats.pct ?? "n/a"} changedSrcFiles=${changedSrcFiles.length}`,
);
console.log(verdict.reason);

if (!verdict.ok) {
  failures.push(verdict.reason);
  const sample = stats.uncovered.slice(0, 40);
  for (const { file, line } of sample) {
    console.error(`::error file=${file},line=${line}::Uncovered changed line`);
  }
  if (stats.uncovered.length > sample.length) {
    console.error(
      `::error::…and ${stats.uncovered.length - sample.length} more uncovered changed lines`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`::error::${failure}`);
  }
  process.exit(1);
}

console.log("ok: diff coverage");
