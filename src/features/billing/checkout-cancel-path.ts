/**
 * Allow-listed cancel_url paths for Stripe Checkout.
 * Kept free of server-only so client CheckoutButton can type-check the same set.
 */
export const CHECKOUT_CANCEL_PATHS = [
  "/subscribe",
  "/documents/trial",
] as const;

export type CheckoutCancelPath = (typeof CHECKOUT_CANCEL_PATHS)[number];

const cancelPathSet = new Set<string>(CHECKOUT_CANCEL_PATHS);

export function resolveCheckoutCancelPath(
  raw: string | null | undefined,
  fallback: CheckoutCancelPath = "/subscribe",
): CheckoutCancelPath {
  if (!raw) {
    return fallback;
  }
  if (
    raw.includes("://") ||
    raw.startsWith("//") ||
    raw.includes("?") ||
    raw.includes("#") ||
    !raw.startsWith("/")
  ) {
    return fallback;
  }
  if (cancelPathSet.has(raw)) {
    return raw as CheckoutCancelPath;
  }
  return fallback;
}
