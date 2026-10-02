export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv, mergeEnvSource, localDevDefaults } = await import("./lib/env");
    const usingDefaults =
      process.env.NODE_ENV !== "production" &&
      Object.keys(localDevDefaults).some((key) => {
        const value = process.env[key];
        return value === undefined || value.trim() === "";
      });
    if (usingDefaults) {
      // Ensure merge path is exercised; getEnv applies the same defaults.
      mergeEnvSource(process.env);
      console.info(
        "[env] Using built-in local defaults for missing variables. Copy .env.example to .env to customize (required for Stripe CLI / production builds).",
      );
    }
    getEnv();
  }
}
