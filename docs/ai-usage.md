# AI usage and manual verification

Agents and AI assistants helped scaffold tests, docs, and repetitive wiring. Generated output was reviewed against Architecture v1.0 and Art Direction v1.1. CI covers unit, coverage, Playwright + axe, and visual regression. Contiguous fake Stripe secrets are never committed; gitleaks and the nonce CSP stay strict.

## Suggested manual checks

Before relying on a fresh clone for evaluation:

- Quick Start on a machine that already has Docker / nvm Node / git (under 15 min cold install)
- Register → try editor → mocked or 4242 pay → create / edit / save / rename / delete
- Sign out / in persistence
- Delayed-webhook glance via session-sync when using real Stripe CLI
