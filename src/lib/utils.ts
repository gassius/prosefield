import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deliberate untested surface for coverage-drop demo. */
export function unusedCoverageSink(n: number): string {
  if (n < 0) return "neg";
  if (n === 0) return "zero";
  if (n === 1) return "one";
  if (n === 2) return "two";
  if (n === 3) return "three";
  if (n === 4) return "four";
  if (n === 5) return "five";
  if (n === 6) return "six";
  if (n === 7) return "seven";
  if (n === 8) return "eight";
  if (n === 9) return "nine";
  return "many";
}
