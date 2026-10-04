import "server-only";

/**
 * Minimal PII / sensitive-data inventory for Prosefield.
 *
 * | Field | Where | Handling |
 * |---|---|---|
 * | email | Firebase Auth only | Not duplicated in Firestore |
 * | password | Firebase Auth only | Salted scrypt by Auth; never stored/logged by the app |
 * | session cookie (`__session`) | HttpOnly cookie | Server-verified; never logged |
 * | stripeCustomerId | `users/{uid}`, `subscriptions/{uid}` | Opaque Stripe id (not PII); kept for billing joins |
 * | document title/content | Firestore via Admin | Envelope-encrypted (AES-256-GCM) before write |
 * | display name | not collected | — |
 *
 * Sensitive strings that must land in Firestore use `encryptSensitiveString`.
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
    field: "document.title",
    store: "firestore-documents",
    firestore: "envelope-encrypted",
  },
  {
    field: "document.content",
    store: "firestore-documents",
    firestore: "envelope-encrypted",
  },
] as const;
