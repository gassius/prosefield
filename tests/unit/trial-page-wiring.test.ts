import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const requireSessionOrRedirect = vi.fn();
const getAccountState = vi.fn();
const ctaDestinationForState = vi.fn(() => "/subscribe");

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/features/auth/guards", () => ({
  requireSessionOrRedirect: (...args: unknown[]) =>
    requireSessionOrRedirect(...args),
  getAccountState: () => getAccountState(),
  ctaDestinationForState: (...args: unknown[]) =>
    ctaDestinationForState(...args),
}));

vi.mock("@/components/documents/trial-workspace", () => ({
  TrialWorkspace: (props: { uid: string }) =>
    `trial-workspace:${props.uid}`,
}));

describe("TrialDocumentsPage wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    redirect.mockClear();
    requireSessionOrRedirect.mockReset();
    getAccountState.mockReset();
    ctaDestinationForState.mockClear();
    requireSessionOrRedirect.mockResolvedValue({
      kind: "logged_in",
      uid: "uid-trial",
      email: "trial@example.com",
      subscriptionActive: false,
    });
  });

  it("redirects subscribers away from /documents/trial to /documents", async () => {
    getAccountState.mockResolvedValue({
      kind: "subscriber",
      uid: "uid-sub",
      email: "sub@example.com",
      subscriptionActive: true,
    });
    const TrialDocumentsPage = (
      await import("@/app/(workspace)/documents/trial/page")
    ).default;

    await expect(TrialDocumentsPage()).rejects.toThrow("NEXT_REDIRECT:/documents");
    expect(redirect).toHaveBeenCalledWith("/documents");
  });

  it("renders the trial workspace for signed-in unsubscribed users", async () => {
    getAccountState.mockResolvedValue({
      kind: "logged_in",
      uid: "uid-trial",
      email: "trial@example.com",
      subscriptionActive: false,
    });
    const TrialDocumentsPage = (
      await import("@/app/(workspace)/documents/trial/page")
    ).default;

    const result = await TrialDocumentsPage();
    expect(result).toBeTruthy();
    expect(requireSessionOrRedirect).toHaveBeenCalledWith(
      "/login?next=/documents/trial",
    );
    expect(ctaDestinationForState).toHaveBeenCalled();
  });

  it("redirects logged_out account state to login", async () => {
    getAccountState.mockResolvedValue({ kind: "logged_out" });
    const TrialDocumentsPage = (
      await import("@/app/(workspace)/documents/trial/page")
    ).default;

    await expect(TrialDocumentsPage()).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/documents/trial",
    );
  });
});
