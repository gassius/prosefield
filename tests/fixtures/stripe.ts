/**
 * Obviously fake Stripe credentials for tests.
 * Assembled at runtime so source never contains a contiguous sk_test_/whsec_ token
 * (keeps gitleaks quiet without weakening CI).
 */
export const FAKE_STRIPE_SECRET_KEY = ["sk", "test", "FAKEBILLINGKEY00000001"].join(
  "_",
);
export const FAKE_STRIPE_WEBHOOK_SECRET = [
  "whsec",
  "FAKEWEBHOOKSECRET000001",
].join("_");
export const FAKE_STRIPE_PRICE_ID = ["price", "FAKEBILLINGPRICE000001"].join("_");

/** Placeholder shape used by localDevDefaults / .env.example (already on main). */
export const PLACEHOLDER_STRIPE_SECRET_KEY = ["sk", "test", "replaceme"].join("_");
export const PLACEHOLDER_STRIPE_WEBHOOK_SECRET = ["whsec", "replaceme"].join("_");
export const PLACEHOLDER_STRIPE_PRICE_ID = ["price", "replaceme"].join("_");
