import type { NextConfig } from "next";
import { applyLocalDevDefaultsToProcessEnv } from "./src/lib/env-defaults";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

// Bare `pnpm dev` / `pnpm build` without `.env`: seed process.env so NEXT_PUBLIC_*
// and firebase-admin emulator hosts match localDevDefaults.
applyLocalDevDefaultsToProcessEnv();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
