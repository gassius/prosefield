export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyLocalDevDefaultsToProcessEnv, localDevDefaults } =
      await import("@/lib/env-defaults");
    const usingDefaults =
      process.env.NODE_ENV !== "production" &&
      Object.keys(localDevDefaults).some((key) => {
        const value = process.env[key];
        return value === undefined || value.trim() === "";
      });
    // Mutate process.env so Admin SDK + client public config see emulator hosts.
    applyLocalDevDefaultsToProcessEnv();
    // Demo GIF recording: optional non-placeholder Stripe fixtures + loopback
    // mock host. No-op unless PROSEFIELD_DEMO_GIFS=1; inert on Vercel production.
    const { applyDemoGifsBillingEnv } = await import(
      "@/features/billing/demo-gifs-mode"
    );
    const demoGifsBilling = applyDemoGifsBillingEnv();
    const { logInfo, logError } = await import("@/lib/logger");
    if (usingDefaults) {
      logInfo(
        "[env] Using built-in local defaults for missing variables. Copy .env.example to .env to customize (required for Stripe CLI / production builds).",
      );
    }
    if (demoGifsBilling) {
      logInfo(
        "[env] Demo GIF billing fixtures active (loopback Stripe mock; no real keys).",
      );
    }
    try {
      const { assertStartupEnv } = await import("@/lib/startup-env");
      // Fail closed at startup: refuse to serve when production env is invalid
      // (e.g. emulator hosts without ALLOW_EMULATORS=1).
      await assertStartupEnv();
    } catch (error) {
      logError("[env] Startup env validation failed; exiting.", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }
}
