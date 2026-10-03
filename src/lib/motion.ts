/**
 * Parse a CSS duration (`0.2s`, `200ms`) into milliseconds.
 * Returns `null` for empty, unparseable, NaN, non-finite, or negative values
 * so callers cannot treat invalid computed styles as “already reduced”.
 */
export function cssDurationToMs(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  let maxMs = 0;
  for (const part of parts) {
    const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(part);
    if (!match) {
      return null;
    }
    const raw = Number(match[1]);
    if (!Number.isFinite(raw) || Number.isNaN(raw)) {
      return null;
    }
    const ms = match[2] === "s" ? raw * 1000 : raw;
    if (ms > maxMs) {
      maxMs = ms;
    }
  }
  return maxMs;
}

/**
 * Whether computed styles honour prefers-reduced-motion (effectively off).
 * NaN / unparseable durations fail closed (not reduced).
 */
export function isReducedMotionStyle(input: {
  animationName: string;
  animationDuration: string;
  transitionProperty: string;
  transitionDuration: string;
}): boolean {
  const animMs = cssDurationToMs(input.animationDuration);
  const transitionMs = cssDurationToMs(input.transitionDuration);

  const animationOk =
    input.animationName === "none" ||
    input.animationName === "" ||
    (animMs !== null && animMs <= 10);

  const transitionOk =
    input.transitionProperty === "none" ||
    (transitionMs !== null && transitionMs <= 10);

  return animationOk && transitionOk;
}
