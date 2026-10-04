import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports demoGifsBilling false by default", async () => {
    vi.stubEnv("PROSEFIELD_DEMO_GIFS", "");
    const { GET } = await import("@/app/api/health/route");
    const response = GET();
    const body = (await response.json()) as {
      ok: boolean;
      demoGifsBilling: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.demoGifsBilling).toBe(false);
  });

  it("reports demoGifsBilling true only on the local allow-list with the flag", async () => {
    vi.stubEnv("PROSEFIELD_DEMO_GIFS", "1");
    vi.stubEnv("ALLOW_EMULATORS", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
    // Ensure VERCEL is unset for the allow-list.
    vi.stubEnv("VERCEL", "");

    const { GET } = await import("@/app/api/health/route");
    const response = GET();
    const body = (await response.json()) as { demoGifsBilling: boolean };
    expect(body.demoGifsBilling).toBe(true);
  });
});
