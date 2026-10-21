#!/usr/bin/env node
/**
 * Enforce the coverage ratchet against coverage-baseline.json.
 *
 * Usage:
 *   node scripts/check-coverage-ratchet.mjs
 *   node scripts/check-coverage-ratchet.mjs --update   # raise baseline to measured (never lower)
 *
 * On PRs, set COVERAGE_RATCHET_BASE to the pull_request base SHA so the
 * baseline cannot be lowered relative to the merge base (higher of PR file
 * vs `git show $BASE:coverage-baseline.json` wins; PR below base fails).
 *
 * Expects `coverage/coverage-summary.json` from `pnpm test:coverage`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  COVERAGE_FLOOR,
  compareToBaseline,
  mergeBaselines,
  parseMetricMap,
  ratchetBaseline,
  totalsFromSummary,
} from "./coverage-metrics.mjs";

const root = process.cwd();
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
const baselinePath = path.join(root, "coverage-baseline.json");
const baseRef = process.env.COVERAGE_RATCHET_BASE?.trim() || "";

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
 * @param {string} ref
 * @returns {import("./coverage-metrics.mjs").MetricMap | null}
 */
function loadBaselineFromGit(ref) {
  try {
    const raw = execFileSync(
      "git",
      ["show", `${ref}:coverage-baseline.json`],
      { encoding: "utf8", cwd: root },
    );
    return parseMetricMap(JSON.parse(raw), `${ref}:coverage-baseline.json`);
  } catch {
    // First introduction of the file on a PR, or shallow history without the blob.
    return null;
  }
}

const update = process.argv.includes("--update");

const summary = loadJson(summaryPath, "coverage summary");
const baselineRaw = loadJson(baselinePath, "coverage baseline");
const measured = totalsFromSummary(summary);
const prBaseline = parseMetricMap(baselineRaw, "coverage-baseline.json");
const baseBaseline = baseRef ? loadBaselineFromGit(baseRef) : null;
const { effective: mergedBaseline, lowered } = mergeBaselines(
  prBaseline,
  baseBaseline,
);

console.log(
  `Coverage measured: statements=${measured.statements}% branches=${measured.branches}% functions=${measured.functions}% lines=${measured.lines}%`,
);
console.log(
  `Coverage PR baseline: statements=${prBaseline.statements}% branches=${prBaseline.branches}% functions=${prBaseline.functions}% lines=${prBaseline.lines}%`,
);
if (baseRef) {
  if (baseBaseline) {
    console.log(
      `Coverage base (${baseRef}) baseline: statements=${baseBaseline.statements}% branches=${baseBaseline.branches}% functions=${baseBaseline.functions}% lines=${baseBaseline.lines}%`,
    );
  } else {
    console.log(
      `Coverage base (${baseRef}): no coverage-baseline.json yet (using PR file only)`,
    );
  }
}
console.log(
  `Coverage effective baseline: statements=${mergedBaseline.statements}% branches=${mergedBaseline.branches}% functions=${mergedBaseline.functions}% lines=${mergedBaseline.lines}% (floor ${COVERAGE_FLOOR}%)`,
);

if (lowered.length > 0) {
  for (const failure of lowered) {
    console.error(`::error::${failure}`);
  }
  console.error(
    "Coverage ratchet failed: PR coverage-baseline.json is below the merge-base baseline.",
  );
  process.exit(1);
}

const proposed = update
  ? ratchetBaseline(measured, mergedBaseline, COVERAGE_FLOOR)
  : { next: mergedBaseline, raised: /** @type {string[]} */ ([]) };
const effectiveBaseline = proposed.next;

const { ok, failures } = compareToBaseline(
  measured,
  effectiveBaseline,
  COVERAGE_FLOOR,
);
if (!ok) {
  for (const failure of failures) {
    console.error(`::error::${failure}`);
  }
  console.error(
    "Coverage ratchet failed. Raise tests or restore coverage; never lower coverage-baseline.json by hand.",
  );
  process.exit(1);
}

if (update) {
  writeFileSync(baselinePath, `${JSON.stringify(effectiveBaseline, null, 2)}\n`);
  if (proposed.raised.length === 0) {
    console.log("Baseline unchanged (measured did not exceed current baseline).");
  } else {
    console.log(`Baseline raised:\n  - ${proposed.raised.join("\n  - ")}`);
  }
}

console.log("ok: coverage meets floor and baseline (ratchet)");
