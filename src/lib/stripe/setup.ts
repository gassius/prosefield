/**
 * Local Stripe setup orchestration for `pnpm stripe:setup`.
 * Writes STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET into `.env`.
 * Never prints or logs secret values.
 */
import {
  assertStripeTestSecretKey,
  getEnvKey,
  upsertEnvKey,
} from "@/lib/stripe/dev-env";

export type StripeSetupDeps = {
  envFilePath: string;
  readFile: (path: string) => string;
  writeFile: (path: string, contents: string) => void;
  seedPriceId: (secretKey: string) => Promise<string>;
  printWebhookSecret: () => Promise<string>;
  /** Status messages only — never pass secret values. */
  log?: (message: string) => void;
};

export class StripeSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSetupError";
  }
}

/** Exported for branch coverage of Error vs non-Error throws. */
export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runStripeSetup(deps: StripeSetupDeps): Promise<void> {
  let content: string;
  try {
    content = deps.readFile(deps.envFilePath);
  } catch {
    throw new StripeSetupError(
      `Missing ${deps.envFilePath}. Create it with STRIPE_SECRET_KEY=sk_test_… or rk_test_… (never commit .env).`,
    );
  }

  const secretKey = getEnvKey(content, "STRIPE_SECRET_KEY");
  try {
    assertStripeTestSecretKey(secretKey);
  } catch (error) {
    throw new StripeSetupError(formatUnknownError(error));
  }

  const priceId = await deps.seedPriceId(secretKey);
  content = upsertEnvKey(content, "STRIPE_PRICE_ID", priceId);
  deps.writeFile(deps.envFilePath, content);
  deps.log?.("Updated STRIPE_PRICE_ID in .env");

  const webhookSecret = (await deps.printWebhookSecret()).trim();
  if (
    !webhookSecret.startsWith("whsec_") ||
    webhookSecret.length <= "whsec_".length
  ) {
    throw new StripeSetupError(
      "stripe-cli listen --print-secret did not return a whsec_… value. Is Docker running?",
    );
  }

  content = upsertEnvKey(content, "STRIPE_WEBHOOK_SECRET", webhookSecret);
  deps.writeFile(deps.envFilePath, content);
  deps.log?.("Updated STRIPE_WEBHOOK_SECRET in .env");
  deps.log?.("Stripe setup complete.");
}
