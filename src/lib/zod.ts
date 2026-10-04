/**
 * Shared Zod entrypoint. Forces `jitless` before any schema work so Zod never
 * probes with `new Function` — under a nonce CSP that probe still fires a
 * `securitypolicyviolation` (script-src / eval) even when the throw is caught.
 *
 * Import `z` / `ZodError` from here, not from `"zod"`, in app code.
 */
import { z, ZodError } from "zod";

z.config({ jitless: true });

export { z, ZodError };
export type { ZodType } from "zod";
