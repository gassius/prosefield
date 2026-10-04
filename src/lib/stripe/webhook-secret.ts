/**
 * Stripe CLI webhook-secret helpers for local `pnpm stripe:setup`.
 * Never print or log secret values — scrub before surfacing errors.
 */
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { formatUnknownError, StripeSetupError } from "@/lib/stripe/setup";

const defaultExecFile = promisify(nodeExecFile);

/** Exact argv for `docker compose run --rm stripe-cli listen --print-secret`. */
export const STRIPE_PRINT_SECRET_DOCKER_ARGS = [
  "compose",
  "run",
  "--rm",
  "stripe-cli",
  "listen",
  "--print-secret",
] as const;

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options?: {
    env?: NodeJS.ProcessEnv;
    maxBuffer?: number;
  },
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Redact Stripe secret-shaped tokens from text before logging or wrapping errors.
 * Covers whsec_ / sk_test_|sk_live_ / rk_test_|rk_live_.
 */
export function scrubStripeSecrets(text: string): string {
  return text
    .replace(/whsec_[A-Za-z0-9]+/g, "whsec_[redacted]")
    .replace(/sk_(?:test|live)_[A-Za-z0-9]+/g, "sk_[redacted]")
    .replace(/rk_(?:test|live)_[A-Za-z0-9]+/g, "rk_[redacted]");
}

/**
 * Run `docker compose run --rm stripe-cli listen --print-secret`.
 * Prefers stdout; falls back to stderr when stdout is empty.
 * Never logs child output. Scrubs secrets on the error path.
 */
export async function printWebhookSecret(
  execFile: ExecFileFn = defaultExecFile,
): Promise<string> {
  try {
    const { stdout, stderr } = await execFile(
      "docker",
      [...STRIPE_PRINT_SECRET_DOCKER_ARGS],
      {
        env: process.env,
        maxBuffer: 1024 * 1024,
      },
    );
    // Strip CR that Docker/TTY sometimes appends (must not land in .env).
    const fromOut = stdout.replace(/\r/g, "").trim();
    if (fromOut) {
      return fromOut;
    }
    return stderr.replace(/\r/g, "").trim();
  } catch (error: unknown) {
    const message = formatUnknownError(error);
    const scrubbed = scrubStripeSecrets(message);
    throw new StripeSetupError(
      `Failed to run stripe-cli listen --print-secret. Is Docker running? (${scrubbed})`,
    );
  }
}

/** Log a setup failure without ever printing secret-shaped tokens. */
export function logStripeSetupFailure(
  error: unknown,
  errorLog: (message: string) => void,
): void {
  const message = formatUnknownError(error);
  errorLog(`stripe:setup failed: ${scrubStripeSecrets(message)}`);
}
