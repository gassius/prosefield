/**
 * Shared security header values (no `server-only` — used by `next.config.ts`
 * and `src/proxy.ts`).
 */
export const HSTS_HEADER =
  "max-age=63072000; includeSubDomains; preload";

/**
 * Strict CSP with upgrade-insecure-requests. Local emulator connect targets are
 * included so Auth/Firestore emulator traffic is not blocked in Docker Compose.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Next.js App Router needs inline scripts/styles in the default setup.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  [
    "connect-src 'self'",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.cloudfunctions.net",
    "http://127.0.0.1:9099",
    "http://127.0.0.1:8080",
    "http://localhost:9099",
    "http://localhost:8080",
    "ws://127.0.0.1:8080",
    "ws://localhost:8080",
  ].join(" "),
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: HSTS_HEADER },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];
