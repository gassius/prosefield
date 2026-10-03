export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyLocalDevDefaultsToProcessEnv, localDevDefaults } =
      await import("./lib/env-defaults");
    const usingDefaults =
      process.env.NODE_ENV !== "production" &&
      Object.keys(localDevDefaults).some((key) => {
        const value = process.env[key];
        return value === undefined || value.trim() === "";
      });
    // Mutate process.env so Admin SDK + client public config see emulator hosts.
    applyLocalDevDefaultsToProcessEnv();
    if (usingDefaults) {
      console.info(
        "[env] Using built-in local defaults for missing variables. Copy .env.example to .env to customize (required for Stripe CLI / production builds).",
      );
    }
    try {
      const { assertStartupEnv } = await import("./lib/startup-env");
      // Fail closed at startup: refuse to serve when production env is invalid
      // (e.g. emulator hosts without ALLOW_EMULATORS=1).
      await assertStartupEnv();
    } catch (error) {
      console.error("[env] Startup env validation failed; exiting.", error);
      process.exit(1);
    }
  }
}
