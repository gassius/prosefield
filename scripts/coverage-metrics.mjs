/**
 * Shared helpers for coverage ratchet + diff coverage checks.
 * Pure functions; no Vitest dependency so unit tests can import freely.
 */

/** Absolute floor — never configure the ratchet below this. */
export const COVERAGE_FLOOR = 90;

/** Diff-coverage bar for new/changed instrumented lines under src/. */
export const DIFF_COVERAGE_THRESHOLD = 90;

export const METRICS = /** @type {const} */ ([
  "statements",
  "branches",
  "functions",
  "lines",
]);

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @typedef {{ statements: number, branches: number, functions: number, lines: number }} MetricMap
 */

/**
 * @param {unknown} raw
 * @param {string} label
 * @returns {MetricMap}
 */
export function parseMetricMap(raw, label) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${label}: expected an object`);
  }
  /** @type {MetricMap} */
  const out = {
    statements: 0,
    branches: 0,
    functions: 0,
    lines: 0,
  };
  for (const key of METRICS) {
    const value = /** @type {Record<string, unknown>} */ (raw)[key];
    if (!isFiniteNumber(value)) {
      throw new Error(`${label}: missing or non-numeric "${key}"`);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Read totals from Vitest/Istanbul `coverage-summary.json` (`total.*.pct`).
 * @param {unknown} summary
 * @returns {MetricMap}
 */
export function totalsFromSummary(summary) {
  if (!summary || typeof summary !== "object") {
    throw new Error("coverage-summary.json: expected an object");
  }
  const total = /** @type {Record<string, unknown>} */ (summary).total;
  if (!total || typeof total !== "object") {
    throw new Error("coverage-summary.json: missing total");
  }
  /** @type {Record<string, number>} */
  const pcts = {};
  for (const key of METRICS) {
    const entry = /** @type {Record<string, unknown>} */ (total)[key];
    if (!entry || typeof entry !== "object") {
      throw new Error(`coverage-summary.json: missing total.${key}`);
    }
    const pct = /** @type {Record<string, unknown>} */ (entry).pct;
    if (!isFiniteNumber(pct)) {
      throw new Error(`coverage-summary.json: total.${key}.pct is not a number`);
    }
    pcts[key] = pct;
  }
  return parseMetricMap(pcts, "coverage-summary totals");
}

/**
 * Compare measured totals to floor + baseline.
 * @param {MetricMap} measured
 * @param {MetricMap} baseline
 * @param {number} [floor]
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function compareToBaseline(measured, baseline, floor = COVERAGE_FLOOR) {
  /** @type {string[]} */
  const failures = [];
  for (const key of METRICS) {
    if (baseline[key] < floor) {
      failures.push(
        `baseline ${key}=${baseline[key]} is below floor ${floor} (fix the baseline file)`,
      );
      continue;
    }
    if (measured[key] + 1e-9 < floor) {
      failures.push(
        `${key}: measured ${measured[key]}% is below floor ${floor}%`,
      );
    }
    if (measured[key] + 1e-9 < baseline[key]) {
      failures.push(
        `${key}: measured ${measured[key]}% is below baseline ${baseline[key]}% (ratchet only moves up)`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Propose a new baseline: max(current baseline, measured) per metric, never below floor.
 * @param {MetricMap} measured
 * @param {MetricMap} baseline
 * @param {number} [floor]
 * @returns {{ next: MetricMap, raised: string[] }}
 */
export function ratchetBaseline(measured, baseline, floor = COVERAGE_FLOOR) {
  /** @type {MetricMap} */
  const next = {
    statements: Math.max(floor, baseline.statements, measured.statements),
    branches: Math.max(floor, baseline.branches, measured.branches),
    functions: Math.max(floor, baseline.functions, measured.functions),
    lines: Math.max(floor, baseline.lines, measured.lines),
  };
  /** @type {string[]} */
  const raised = [];
  for (const key of METRICS) {
    if (next[key] > baseline[key] + 1e-9) {
      raised.push(`${key}: ${baseline[key]} → ${next[key]}`);
    }
  }
  return { next, raised };
}

/**
 * Parse `git diff -U0` output into added line numbers per file path.
 * Only tracks added (`+`) lines; file paths are normalized to repo-relative.
 * @param {string} diffText
 * @returns {Map<string, Set<number>>}
 */
export function parseAddedLinesFromDiff(diffText) {
  /** @type {Map<string, Set<number>>} */
  const map = new Map();
  let currentFile = null;
  let newLine = 0;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const raw = line.slice(4).trim();
      if (raw === "/dev/null") {
        currentFile = null;
        continue;
      }
      currentFile = raw.startsWith("b/") ? raw.slice(2) : raw;
      if (!map.has(currentFile)) {
        map.set(currentFile, new Set());
      }
      continue;
    }
    if (!currentFile) continue;

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      map.get(currentFile)?.add(newLine);
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      // Removed line — does not advance new-file line counter.
      continue;
    }
    if (line.startsWith(" ") || line === "") {
      newLine += 1;
    }
  }

  return map;
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSrcPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized === "src" || normalized.startsWith("src/");
}

/**
 * Line hit map from Istanbul/V8 coverage-final entry (`s` + `statementMap`).
 * @param {{ s?: Record<string, number>, statementMap?: Record<string, { start: { line: number }, end: { line: number } }> }} fileCov
 * @returns {Map<number, number>} line → hit count (max across statements on that line)
 */
export function lineHitsFromFileCoverage(fileCov) {
  /** @type {Map<number, number>} */
  const hits = new Map();
  const statementMap = fileCov.statementMap ?? {};
  const s = fileCov.s ?? {};
  for (const [id, loc] of Object.entries(statementMap)) {
    const start = loc?.start?.line;
    if (!isFiniteNumber(start)) continue;
    const count = s[id] ?? 0;
    const prev = hits.get(start) ?? 0;
    hits.set(start, Math.max(prev, count));
  }
  return hits;
}

/**
 * Diff coverage for added lines that are instrumented.
 * @param {Map<string, Set<number>>} addedByFile
 * @param {Record<string, { s?: Record<string, number>, statementMap?: Record<string, { start: { line: number }, end: { line: number } }> }>} coverageFinal
 * @returns {{ instrumented: number, covered: number, pct: number | null, uncovered: { file: string, line: number }[] }}
 */
export function diffCoverageStats(addedByFile, coverageFinal) {
  let instrumented = 0;
  let covered = 0;
  /** @type {{ file: string, line: number }[]} */
  const uncovered = [];

  /** @type {Map<string, string>} absolute/relative key → coverage key */
  const covKeys = new Map();
  for (const key of Object.keys(coverageFinal)) {
    const norm = key.replace(/\\/g, "/");
    covKeys.set(norm, key);
    // Also index by trailing src/… segment when Vitest uses absolute paths.
    const srcIdx = norm.lastIndexOf("/src/");
    if (srcIdx !== -1) {
      covKeys.set(norm.slice(srcIdx + 1), key);
    } else if (norm.startsWith("src/")) {
      covKeys.set(norm, key);
    }
  }

  for (const [file, lines] of addedByFile) {
    if (!isSrcPath(file)) continue;
    const norm = file.replace(/\\/g, "/");
    const covKey =
      covKeys.get(norm) ??
      covKeys.get(norm.startsWith("./") ? norm.slice(2) : norm);
    if (!covKey) continue;
    const fileCov = coverageFinal[covKey];
    if (!fileCov) continue;
    const hits = lineHitsFromFileCoverage(fileCov);
    for (const line of lines) {
      if (!hits.has(line)) continue; // not instrumented (comment/type-only/etc.)
      instrumented += 1;
      if ((hits.get(line) ?? 0) > 0) {
        covered += 1;
      } else {
        uncovered.push({ file: norm, line });
      }
    }
  }

  const pct =
    instrumented === 0 ? null : Math.round((covered / instrumented) * 10000) / 100;
  return { instrumented, covered, pct, uncovered };
}

/**
 * @param {number | null} pct
 * @param {number} [threshold]
 * @returns {{ ok: boolean, reason: string }}
 */
export function evaluateDiffCoverage(pct, threshold = DIFF_COVERAGE_THRESHOLD) {
  if (pct === null) {
    return {
      ok: true,
      reason: "no instrumented added lines under src/; diff coverage skipped",
    };
  }
  if (pct + 1e-9 < threshold) {
    return {
      ok: false,
      reason: `diff coverage ${pct}% is below ${threshold}% for new/changed instrumented lines under src/`,
    };
  }
  return { ok: true, reason: `diff coverage ${pct}% meets ${threshold}%` };
}
