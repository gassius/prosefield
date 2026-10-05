# Prosefield

[![CI](https://github.com/gassius/prosefield/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gassius/prosefield/actions/workflows/ci.yml?query=branch%3Amain)
[![coverage](https://img.shields.io/badge/coverage-99.96%25-brightgreen)](docs/testing.md)
[![tests](https://img.shields.io/badge/tests-664%20passed-brightgreen)](docs/testing.md)
[![Node 24](https://img.shields.io/badge/node-24-brightgreen)](.nvmrc)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6)](tsconfig.json)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)

A writing workspace: register, subscribe, and keep pages with less friction.

## Let your agent set up and run this project (locally)

Paste this into any coding agent (or point it at the raw file):

```text
Follow https://raw.githubusercontent.com/gassius/prosefield/main/AGENT_SETUP.md
end to end. Stop and ask me before any system-wide install.
```

Full prompt: [`AGENT_SETUP.md`](AGENT_SETUP.md).

---

## Quick start

Works on **macOS**, **Linux**, and **Windows via WSL2** (Ubuntu) with [Docker Desktop’s WSL2 backend](https://docs.docker.com/desktop/features/wsl/) **or** [Docker Engine inside WSL2](https://docs.docker.com/engine/install/). On Windows, follow Microsoft’s [WSL install guide](https://learn.microsoft.com/en-us/windows/wsl/install) and run every command **inside WSL2** — not PowerShell or Git Bash. Clone into the Linux filesystem (for example `~/prosefield`), **not** `/mnt/c/…`.

The under-15-minute path assumes **Docker, Node (via nvm), and git are already installed**. Installing WSL2 or Docker Desktop for the first time is separate (large downloads / reboot) and is not counted in that budget. CI’s fresh-start job times a cold pnpm store (no cache) plus image build on a runner that already has Docker and Node.

1. **Clone**

   ```bash
   git clone https://github.com/gassius/prosefield.git
   cd prosefield
   ```

   On WSL2: `git clone … ~/prosefield && cd ~/prosefield`.

2. **Check** your machine (prints pass/fail; stops with install links if something is missing)

   ```bash
   bash scripts/check.sh
   ```

3. **Start** (installs project dependencies, starts the backend in Docker, runs the app)

   ```bash
   bash scripts/start.sh
   ```

Open http://localhost:3000. Stop with `bash scripts/stop.sh`.

After sign-up, `/subscribe` shows **Billing is not configured** when using default `.env.example` placeholders (no real Stripe keys). Use **Try the editor** for a trial draft, or follow [Manual Stripe test payment (4242)](#manual-stripe-test-payment-4242) for a real test-card unlock. Playwright and the demo GIFs **mock** payment by seeding emulator entitlement — never commit real keys.

**Prerequisites (summary):** nvm, matching Node, pnpm, Docker + Compose v2. Emulators run only inside Docker — **do not install the Firebase CLI on the host**. Details and a host-only manual start: [`docs/local-development.md`](docs/local-development.md).

## Demo

### Landing
![Landing](docs/demo/01-landing.gif)

### Try the editor, register, and pay (mocked)
![Try the editor, register, and pay (mocked)](docs/demo/02-try-register-pay.gif)

### Create, edit, save, rename, delete a document
![Create, edit, save, rename, delete](docs/demo/03-document-crud.gif)

Note: Regenerate with `pnpm demo:gifs` while the app and emulators are already running (Docker + ffmpeg; prefer a production `pnpm build && pnpm start` so the Next.js dev indicator is absent).

## Architecture

Prosefield is one **Next.js 16** App Router app (React 19, TypeScript strict) with Firebase Auth/Firestore (Docker emulators locally), Stripe Checkout in test mode, and a Tiptap editor. Stack choices, routes, data model, and security boundaries: [`docs/architecture.md`](docs/architecture.md).

## Surfaces

Public marketing/pricing and the authenticated document workspace — how entitlement, delayed webhooks, and one security decision work: [`docs/write-up.md`](docs/write-up.md).

## Manual Stripe test payment (4242)

CI never needs real Stripe credentials or network. For a local end-to-end payment with **test-mode** keys:

1. Put your `sk_test_…` or `rk_test_…` in `.env` as `STRIPE_SECRET_KEY` (never commit `.env`).
2. Run `pnpm stripe:setup` (seeds Price + webhook secret into `.env`; requires Docker).
3. Start webhook forwarding with Next.js in Docker (Skip host `pnpm dev` — the `app` service also binds `:3000`):

   ```bash
   docker compose --profile app --profile stripe up
   ```

4. Register, open `/subscribe`, continue to Checkout, pay with `4242 4242 4242 4242` (any future expiry, any CVC).

Full setup notes, env requirements, and Playwright mocking: [`docs/stripe-testing.md`](docs/stripe-testing.md).

## Testing

```bash
pnpm test              # Vitest unit
pnpm test:component    # RTL + jsdom
pnpm test:coverage     # unit + component + integration (needs emulators + env)
pnpm test:e2e          # Playwright + axe (app + emulators)
pnpm test:visual       # visual regression (Playwright Docker image)
```

Full commands with the same env CI uses, plus scripts inventory: [`docs/testing.md`](docs/testing.md). Policy: [AGENTS.md → Testing requirements](AGENTS.md#testing-requirements).

## More docs

| Doc | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture (v1.0) |
| [`docs/art-direction.md`](docs/art-direction.md) | Art Direction & Design Guide (v1.1) |
| [`docs/write-up.md`](docs/write-up.md) | Surfaces / entitlement / security answers |
| [`docs/local-development.md`](docs/local-development.md) | Prerequisites, manual start, emulators, Compose profiles |
| [`docs/stripe-testing.md`](docs/stripe-testing.md) | Stripe test payment details |
| [`docs/testing.md`](docs/testing.md) | Unit, integration, E2E, visual — copy-paste commands |
| [`docs/design-notes.md`](docs/design-notes.md) | Limitations, tradeoffs, next steps |
| [`docs/security.md`](docs/security.md) | Encryption, transport, personal data, passwords |
| [`docs/ai-usage.md`](docs/ai-usage.md) | AI assistance and manual verification |

## Credits

- Product and Art Direction: Carlos González Rico
- Architecture v1.0 / delivery system: Engineer Supervisor + GasNet agents on the Prosefield Cursor Project
- Stack: Next.js, Firebase Auth/Firestore, Stripe, Tiptap, Playwright, Vitest
