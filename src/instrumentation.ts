export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      getEnv,
      applyLocalDevDefaultsToProcessEnv,
      localDevDefaults,
    } = await import("./lib/env");
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
    getEnv();
  }
}
