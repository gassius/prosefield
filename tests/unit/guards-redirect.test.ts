import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

describe("guards requireSessionOrRedirect", () => {
  beforeEach(() => {
    __resetCookieStore();
  });

  it("redirects to the login path when there is no session", async () => {
    const { requireSessionOrRedirect } = await import("@/features/auth/guards");
    await expect(requireSessionOrRedirect("/login")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});
