import { afterEach, describe, expect, it, vi } from "vitest";

const initializeApp = vi.fn((..._args: unknown[]) => ({ name: "app" }));
const getApps = vi.fn(() => [] as unknown[]);
const applicationDefault = vi.fn(() => ({ type: "adc" }));
const getAuth = vi.fn((..._args: unknown[]) => ({ name: "auth" }));
const getFirestore = vi.fn((..._args: unknown[]) => ({ name: "firestore" }));

vi.mock("firebase-admin/app", () => ({
  initializeApp: (options?: unknown) => initializeApp(options),
  getApps: () => getApps(),
  applicationDefault: () => applicationDefault(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: (app?: unknown) => getAuth(app),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: (app?: unknown) => getFirestore(app),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    FIREBASE_PROJECT_ID: "demo-prosefield",
    FIREBASE_AUTH_EMULATOR_HOST: process.env.__TEST_AUTH_EMU,
    FIRESTORE_EMULATOR_HOST: process.env.__TEST_FS_EMU,
  }),
}));

describe("firebase admin bootstrap", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.__TEST_AUTH_EMU;
    delete process.env.__TEST_FS_EMU;
    vi.unstubAllEnvs();
  });

  it("initializes without credentials when emulator hosts are set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.__TEST_AUTH_EMU = "127.0.0.1:9099";
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue({ name: "app" });

    const { getAdminApp } = await import("@/lib/firebase/admin");
    expect(getAdminApp()).toEqual({ name: "app" });
    expect(initializeApp).toHaveBeenCalledWith({
      projectId: "demo-prosefield",
    });
    expect(applicationDefault).not.toHaveBeenCalled();
  });

  it("refuses emulator hosts in production without ALLOW_EMULATORS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    process.env.__TEST_AUTH_EMU = "127.0.0.1:9099";
    getApps.mockReturnValue([]);

    const { getAdminApp } = await import("@/lib/firebase/admin");
    expect(() => getAdminApp()).toThrow(/ALLOW_EMULATORS=1/i);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("uses applicationDefault credentials without emulator hosts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue({ name: "prod-app" });

    const { getAdminApp, getAdminAuth, getAdminFirestore } = await import(
      "@/lib/firebase/admin"
    );
    expect(getAdminApp()).toEqual({ name: "prod-app" });
    expect(initializeApp).toHaveBeenCalledWith({
      projectId: "demo-prosefield",
      credential: { type: "adc" },
    });
    expect(applicationDefault).toHaveBeenCalled();
    expect(getAdminAuth()).toEqual({ name: "auth" });
    expect(getAdminFirestore()).toEqual({ name: "firestore" });
  });

  it("reuses an existing admin app", async () => {
    getApps.mockReturnValue([{ name: "existing" }]);
    const { getAdminApp } = await import("@/lib/firebase/admin");
    expect(getAdminApp()).toEqual({ name: "existing" });
    expect(initializeApp).not.toHaveBeenCalled();
  });
});
