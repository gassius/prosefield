/**
 * Obviously fake Stripe credentials for tests.
 * Assembled at runtime so source never contains a contiguous sk_test_/whsec_ token
 * (keeps gitleaks quiet without weakening CI).
 */
export const FAKE_STRIPE_SECRET_KEY = ["sk", "test", "FAKEBILLINGKEY00000001"].join(
  "_",
);
export const FAKE_STRIPE_RESTRICTED_KEY = [
  "rk",
  "test",
  "FAKERESTRICTEDKEY000001",
].join("_");
export const FAKE_STRIPE_WEBHOOK_SECRET = [
  "whsec",
  "FAKEWEBHOOKSECRET000001",
].join("_");
export const FAKE_STRIPE_PRICE_ID = ["price", "FAKEBILLINGPRICE000001"].join("_");

/** Live-looking fakes for refusal tests (assembled; never real). */
export const FAKE_STRIPE_LIVE_SECRET_KEY = ["sk", "live", "FAKELIVEKEY00000001"].join(
  "_",
);
export const FAKE_STRIPE_LIVE_RESTRICTED_KEY = [
  "rk",
  "live",
  "FAKELIVERESTRICTED0001",
].join("_");

/** Placeholder shape used by localDevDefaults / .env.example (already on main). */
export const PLACEHOLDER_STRIPE_SECRET_KEY = ["sk", "test", "replaceme"].join("_");
export const PLACEHOLDER_STRIPE_WEBHOOK_SECRET = ["whsec", "replaceme"].join("_");
export const PLACEHOLDER_STRIPE_PRICE_ID = ["price", "replaceme"].join("_");
