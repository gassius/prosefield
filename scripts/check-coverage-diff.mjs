#!/usr/bin/env node
/**
 * Diff coverage for new/changed instrumented lines under src/.
 *
 * Usage:
 *   COVERAGE_DIFF_BASE=<sha-or-ref> node scripts/check-coverage-diff.mjs
 *
 * Expects `coverage/coverage-final.json` from `pnpm test:coverage` (json reporter).
 * On PRs, CI sets COVERAGE_DIFF_BASE to the pull_request base SHA.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DIFF_COVERAGE_THRESHOLD,
  diffCoverageStats,
  evaluateDiffCoverage,
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

let diffText;
try {
  diffText = execFileSync(
    "git",
    ["diff", "-U0", "--diff-filter=ACMR", `${base}...HEAD`, "--", "src/"],
    { encoding: "utf8", cwd: root, maxBuffer: 32 * 1024 * 1024 },
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`::error::git diff failed against ${base}: ${message}`);
  process.exit(1);
}

const coverageFinal = loadJson(finalPath, "coverage-final.json");
const addedByFile = parseAddedLinesFromDiff(diffText);
const stats = diffCoverageStats(addedByFile, coverageFinal);
const verdict = evaluateDiffCoverage(stats.pct, DIFF_COVERAGE_THRESHOLD);

console.log(
  `Diff coverage base=${base}: instrumented=${stats.instrumented} covered=${stats.covered} pct=${stats.pct ?? "n/a"}`,
);
console.log(verdict.reason);

if (!verdict.ok) {
  const sample = stats.uncovered.slice(0, 40);
  for (const { file, line } of sample) {
    console.error(`::error file=${file},line=${line}::Uncovered changed line`);
  }
  if (stats.uncovered.length > sample.length) {
    console.error(
      `::error::…and ${stats.uncovered.length - sample.length} more uncovered changed lines`,
    );
  }
  process.exit(1);
}

console.log("ok: diff coverage");
