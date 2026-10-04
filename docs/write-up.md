# Write-up (draft for Carlos)

Answers to the three take-home questions. Edit freely before submission.

## 1. How does your app determine whether a user is an active subscriber?

Entitlement is **server-side only**. After Firebase Auth establishes a session cookie (`__session`), document and workspace guards load the user’s subscription **projection** from Firestore (`subscriptions/{uid}`) and treat the user as entitled only when `status` is `active` (`isEntitledStatus` / `ENTITLED_SUBSCRIPTION_STATUS` — no other Stripe statuses grant access).

That projection is written by:

- verified Stripe **webhooks** (signature-checked, then a canonical Subscription fetch), or
- the **session-sync** path on `/billing/status` (server retrieves the Checkout Session from Stripe and projects the same way).

The browser never decides entitlement. Firestore rules deny client CRUD on documents; Server Actions enforce session + entitlement before any write.

## 2. What happens if payment succeeds but the webhook is delayed?

Checkout returns the user to `/billing/status?session_id=…`. That page runs a **server-verified session sync**: it loads the Checkout Session from Stripe’s API, checks `client_reference_id` matches the signed-in user, requires `status === "complete"` and a subscription, then upserts the same entitlement projection the webhook would write (idempotent `lastEventId`).

So access unlocks when Stripe confirms the session, even if the webhook is late or reordered. When the webhook later arrives, projection upsert stays idempotent. Playwright acceptance tests mock pay by seeding the projection directly (Architecture §13) — CI never calls Stripe.

## 3. One security decision you made and why

**Server-only Firestore + envelope encryption for document title/content.** Browser clients are deny-all for `/documents`; all reads/writes go through Server Actions and the Admin SDK. Before persistence, title and content are envelope-encrypted (AES-256-GCM) with AAD bound to `uid` + `docId`, and the KEK never lives in Firebase (local/CI use a Compose-owned dev provider; production requires KMS).

Why: a single authorisation and crypto boundary is testable, keeps ciphertext worthless if the database is copied across users, and matches the assignment’s demand for server-validated sessions and server-side subscription gating. Trade-off: no offline or real-time client sync — accepted for this scope.
