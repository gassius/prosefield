# Security

## Encryption at rest (documents)

Document **title** and **content** are envelope-encrypted **server-side** before any Firestore write:

- Per-document random 256-bit data key + **AES-256-GCM**
- Ciphertext, IV, auth tag, wrapped data key, and key version are stored together
- AAD binds each field to `uid` + `docId` + field + key version (ciphertext cannot be copied across users/docs)
- The key-encryption key (KEK) **never** lives in Firebase. Local/CI use `DOCUMENT_ENCRYPTION_PROVIDER=dev` with `DOCUMENT_ENCRYPTION_KEK` from Compose / `.env`; production requires `DOCUMENT_ENCRYPTION_PROVIDER=kms` + `GCP_KMS_KEY_NAME` behind the same `KeyProvider` interface (dev provider and the known local filler KEK are rejected at startup)
- Existing plaintext docs migrate lazily (idempotent) on the next **write** (save/rename/migrate); reads do not rewrite. Migration encrypts the stored content string verbatim and does not bump `updatedAt`
- Key rotation is supported via `DOCUMENT_ENCRYPTION_KEY_VERSION` (+ optional previous KEK)
- **Rollback:** keep the current (or previous) KEK / KMS key version available for decrypt; an admin decrypt-to-plaintext script is backlog if a temporary plaintext restore is needed

Cloud KMS keyring/key/IAM and production env wiring are infrastructure work — not changed by ordinary app PRs.

## Transport

- HSTS and related headers on every response; a **nonce-based** CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`, plus `upgrade-insecure-requests`) from `src/proxy.ts` (`'unsafe-eval'` only in development; emulator `connect-src` origins only outside production or with `ALLOW_EMULATORS=1`)
- Session cookie `__session`: **HttpOnly**, **Secure** (forced when production `APP_URL` is https), **SameSite=Lax**
- `APP_URL` must be `https://` outside local `localhost` / `127.0.0.1`

## Personal data

Minimal inventory: email and password stay in **Firebase Auth** only (email is not duplicated as plaintext in Firestore). `stripeCustomerId`, `stripeCustomers/{id}.uid`, `subscriptions/{uid}`, and `stripeEvents/{id}` hold billing ids/status/event metadata — not email. Document title/content are envelope-encrypted. Optional `emailEnc` exists behind `retainEncryptedEmail` (no in-app caller today). Server logs go through `logError` / `redactForLog` so emails, passwords, and document bodies are not written to error output.

## Passwords

Passwords are handled only by **Firebase Auth**, which hashes them with **salted scrypt**. The app never stores, logs, or sends passwords anywhere else (Firestore, application logs, or analytics). Minimum-length enforcement is covered separately in the register flow and its tests.
