import type { NextConfig } from "next";
import { applyLocalDevDefaultsToProcessEnv } from "./src/lib/env-defaults";
import { buildStaticSecurityHeaders } from "./src/lib/security-headers";

// Bare `pnpm dev` / `pnpm build` without `.env`: seed process.env so NEXT_PUBLIC_*
// and firebase-admin emulator hosts match localDevDefaults.
applyLocalDevDefaultsToProcessEnv();

const nextConfig: NextConfig = {
  async headers() {
    // Static headers only — CSP with a per-request nonce is set in `src/proxy.ts`.
    return [
      {
        source: "/:path*",
        headers: buildStaticSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
