# Design notes

Limitations, tradeoffs, and what would come next. See also Architecture §16.

## Known limitations

- **Docker is required** for Auth/Firestore. There is no host Emulator Suite runtime or global `firebase-tools` fallback.
- **Manual save only** — no autosave, no multi-device conflict resolution, no version history.
- **No real-time collaboration** and no offline client Firestore access (server-only data path).
- **One plan / one price** — no coupons, taxes, trials, or tiered pricing. Plan display falls back to `PLAN_DISPLAY_*` when Stripe is not configured.
- **Stripe live keys are rejected** — only `sk_test_` / `rk_test_` keys are accepted.
- **Customer Portal** is feature-flagged (`FEATURE_CUSTOMER_PORTAL`); "Cancel anytime" copy stays honest with the flag.
- **No production deploy in the default path** — optional Firebase App Hosting is out of the local acceptance path and never blocks it.
- **Non-goals** (out of scope): AI features, uploads/export, admin UI, email verification, dark mode, public API. See Architecture §2.3.

## Documents and Firestore

Document CRUD goes through **Server Actions + the Firebase Admin SDK**. Browser clients never read or write `/documents` — `firestore.rules` default-denies create/update/delete/read for that collection (Architecture §5.6).

Title (**1–120** characters) and content (**≤ 512 KiB** UTF-8 bytes when serialised as Tiptap JSON) are enforced **server-side in Zod** (`src/features/documents/schemas.ts`), not in security rules.

## Tradeoffs and “With another day”

| Choice | Why | Cost |
|---|---|---|
| Docker-only Firebase emulators | Fresh machines need no Firebase project; can’t touch prod | First image pull; Docker required |
| Server-only Firestore | One authorisation layer; deny-all rules | No realtime/offline client |
| Session-sync on `/billing/status` | Unlock when webhooks lag | Extra Stripe retrieve path |
| Manual save + restricted Tiptap | Honest UX matching Art Direction | Less “magic” than autosave |

**With another day:** turn on Customer Portal behind the existing flag; finish optional Firebase App Hosting with budget alert and smoke test; tighten empty/error polish on billing edge cases; record a longer narrated demo.
