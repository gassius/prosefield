#!/usr/bin/env node
/**
 * Enforce the coverage ratchet against coverage-baseline.json.
 *
 * Usage:
 *   node scripts/check-coverage-ratchet.mjs
 *   node scripts/check-coverage-ratchet.mjs --update   # raise baseline to measured (never lower)
 *
 * Expects `coverage/coverage-summary.json` from `pnpm test:coverage`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  COVERAGE_FLOOR,
  compareToBaseline,
  parseMetricMap,
  ratchetBaseline,
  totalsFromSummary,
} from "./coverage-metrics.mjs";

const root = process.cwd();
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
const baselinePath = path.join(root, "coverage-baseline.json");

function loadJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`::error::Failed to read ${label} (${filePath}): ${message}`);
    process.exit(1);
  }
}

const update = process.argv.includes("--update");

const summary = loadJson(summaryPath, "coverage summary");
const baselineRaw = loadJson(baselinePath, "coverage baseline");
const measured = totalsFromSummary(summary);
const baseline = parseMetricMap(baselineRaw, "coverage-baseline.json");

console.log(
  `Coverage measured: statements=${measured.statements}% branches=${measured.branches}% functions=${measured.functions}% lines=${measured.lines}%`,
);
console.log(
  `Coverage baseline: statements=${baseline.statements}% branches=${baseline.branches}% functions=${baseline.functions}% lines=${baseline.lines}% (floor ${COVERAGE_FLOOR}%)`,
);

const proposed = update
  ? ratchetBaseline(measured, baseline, COVERAGE_FLOOR)
  : { next: baseline, raised: /** @type {string[]} */ ([]) };
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
