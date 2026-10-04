import "server-only";

import { redactForLog } from "@/lib/crypto/redact";

/**
 * Server logging that always runs payloads through `redactForLog` so emails,
 * passwords, and document bodies never hit stdout/stderr raw.
 */
export function logError(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.error(message);
    return;
  }
  console.error(message, redactForLog(detail));
}

export function logInfo(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(message);
    return;
  }
  console.info(message, redactForLog(detail));
}

export function logWarn(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.warn(message);
    return;
  }
  console.warn(message, redactForLog(detail));
}
