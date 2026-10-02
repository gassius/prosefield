import type { NextConfig } from "next";
import { applyLocalDevDefaultsToProcessEnv } from "./src/lib/env";

// Bare `pnpm dev` / `pnpm build` without `.env`: seed process.env so NEXT_PUBLIC_*
// and firebase-admin emulator hosts match localDevDefaults.
applyLocalDevDefaultsToProcessEnv();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
