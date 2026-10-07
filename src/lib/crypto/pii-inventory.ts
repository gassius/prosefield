import "server-only";

/**
 * Minimal PII / sensitive-data inventory for Prosefield.
 *
 * | Field / collection | Where | Handling |
 * |---|---|---|
 * | email | Firebase Auth only | Not duplicated in Firestore by default |
 * | password | Firebase Auth only | Salted scrypt by Auth; never stored/logged by the app |
 * | session cookie (`__session`) | HttpOnly cookie | Server-verified; never logged |
 * | stripeCustomerId | `users/{uid}`, `subscriptions/{uid}` | Opaque Stripe id (not PII); billing joins |
 * | uid | `stripeCustomers/{customerId}` | Opaque Firebase uid reverse lookup |
 * | subscription projection | `subscriptions/{uid}` | Status/ids only — no email |
 * | Stripe webhook dedupe | `stripeEvents/{id}` | Event metadata only — no email/PII |
 * | document title/content/ignoredWords | Firestore via Admin | Envelope-encrypted (AES-256-GCM) before write |
 * | emailEnc (optional) | `users/{uid}` | Envelope-encrypted; only when `retainEncryptedEmail` is set (nothing in-app calls it today — Auth remains SoT) |
 * | display name | not collected | — |
 *
 * Sensitive strings that must land in Firestore use `encryptSensitiveString`.
 * Email is Auth-only under the ticket; the optional encrypted profile path exists
 * for rare retention needs and is not wired to any production call site.
 */
export const PII_INVENTORY = [
  {
    field: "email",
    store: "firebase-auth",
    firestore: "never",
  },
  {
    field: "password",
    store: "firebase-auth-scrypt",
    firestore: "never",
  },
  {
    field: "stripeCustomerId",
    store: "firestore-users",
    firestore: "plaintext-reference",
  },
  {
    field: "stripeCustomers.uid",
    store: "firestore-stripeCustomers",
    firestore: "plaintext-reference",
  },
  {
    field: "subscriptions",
    store: "firestore-subscriptions",
    firestore: "status-and-ids-only",
  },
  {
    field: "stripeEvents",
    store: "firestore-stripeEvents",
    firestore: "event-metadata-only",
  },
  {
    field: "document.title",
    store: "firestore-documents",
    firestore: "envelope-encrypted",
  },
  {
    field: "document.content",
    store: "firestore-documents",
    firestore: "envelope-encrypted",
  },
  {
    field: "document.ignoredWords",
    store: "firestore-documents",
    firestore: "envelope-encrypted",
  },
  {
    field: "emailEnc",
    store: "firestore-users",
    firestore: "envelope-encrypted-optional",
  },
] as const;
