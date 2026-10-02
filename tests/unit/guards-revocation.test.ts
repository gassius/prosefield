import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";

const getOptionalSession = vi.fn();

vi.mock("@/features/auth/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/session")>();
  return {
    ...actual,
    getOptionalSession: (...args: unknown[]) => getOptionalSession(...args),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => undefined }),
      }),
    }),
  }),
}));

describe("guards revocation checks", () => {
  beforeEach(() => {
    __resetCookieStore();
    getOptionalSession.mockReset();
    getOptionalSession.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: Math.floor(Date.now() / 1000),
    });
  });

  it("requireSession defaults to checkRevoked true (fails if default flips to false)", async () => {
    const { requireSession } = await import("@/features/auth/guards");
    await requireSession();
    expect(getOptionalSession).toHaveBeenCalledWith(true);
    expect(getOptionalSession).not.toHaveBeenCalledWith(false);
  });

  it("getAccountState always verifies with checkRevoked true", async () => {
    const { getAccountState } = await import("@/features/auth/guards");
    await getAccountState();
    expect(getOptionalSession).toHaveBeenCalledWith(true);
    expect(getOptionalSession).not.toHaveBeenCalledWith(false);
  });

  it("requireSessionOrRedirect verifies with checkRevoked true", async () => {
    vi.resetModules();
    // Re-apply mock after resetModules by re-importing through the mocked path.
    getOptionalSession.mockResolvedValue({
      uid: "u1",
      email: "a@example.com",
      auth_time: Math.floor(Date.now() / 1000),
    });
    const { requireSessionOrRedirect } = await import("@/features/auth/guards");
    await requireSessionOrRedirect("/login");
    expect(getOptionalSession).toHaveBeenCalledWith(true);
  });
});
