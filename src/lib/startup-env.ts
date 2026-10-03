import "server-only";

/**
 * Validate env at process start. Throws (ZodError) when production config is
 * unsafe — callers must exit non-zero so Next never serves 500s lazily.
 */
export async function assertStartupEnv(): Promise<void> {
  const { getEnv } = await import("@/lib/env");
  getEnv();
}
