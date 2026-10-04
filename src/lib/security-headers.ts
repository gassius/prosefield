/**
 * Shared security header values (no `server-only` — used by `next.config.ts`
 * and `src/proxy.ts`).
 */
export const HSTS_HEADER =
  "max-age=63072000; includeSubDomains; preload";

export type CspBuildOptions = {
  /** Per-request nonce for script-src (required for enforcing CSP). */
  nonce: string;
  /** React Refresh / Next dev tooling; never in production. */
  allowUnsafeEval?: boolean;
  /** Auth/Firestore emulator http/ws origins; only local/ALLOW_EMULATORS. */
  allowEmulatorOrigins?: boolean;
};

const EMULATOR_CONNECT = [
  "http://127.0.0.1:9099",
  "http://127.0.0.1:8080",
  "http://localhost:9099",
  "http://localhost:8080",
  "ws://127.0.0.1:8080",
  "ws://localhost:8080",
] as const;

/**
 * Build a strict CSP. Scripts are nonce + strict-dynamic (no 'unsafe-inline').
 * 'unsafe-eval' is opt-in for development only. TipTap/Next inline styles need
 * style-src 'unsafe-inline' (styles are not an XSS script vector here).
 */
export function buildContentSecurityPolicy(options: CspBuildOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${options.nonce}'`,
    "'strict-dynamic'",
  ];
  if (options.allowUnsafeEval) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.cloudfunctions.net",
  ];
  if (options.allowEmulatorOrigins) {
    connectSrc.push(...EMULATOR_CONNECT);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // TipTap and Next inject inline styles; keep 'unsafe-inline' for style-src only.
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc.join(" ")}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Whether the current process should allow emulator connect-src origins. */
export function shouldAllowEmulatorCspOrigins(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV !== "production") {
    return true;
  }
  return env.ALLOW_EMULATORS === "1";
}

/** Whether script-src may include 'unsafe-eval' (Next/React dev only). */
export function shouldAllowUnsafeEval(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "development";
}

/**
 * Static headers for `next.config.ts` (no per-request nonce).
 * CSP is applied per-request in `src/proxy.ts` with a fresh nonce.
 */
export function buildStaticSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Strict-Transport-Security", value: HSTS_HEADER },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}

/** @deprecated Prefer buildContentSecurityPolicy + proxy nonce. */
export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  nonce: "static-fallback-not-for-enforcement",
  allowUnsafeEval: false,
  allowEmulatorOrigins: false,
});

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  ...buildStaticSecurityHeaders(),
];

/** Parse a CSP header into a directive → tokens map for exact assertions. */
export function parseCspDirectives(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of policy.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const [name, ...rest] = trimmed.split(/\s+/);
    if (!name) {
      continue;
    }
    out[name] = rest;
  }
  return out;
}
