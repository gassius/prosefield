import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const getSubscriptionProjection = vi.fn();

vi.mock("@/features/auth/guards", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
}));

vi.mock("@/features/billing/projection", () => ({
  getSubscriptionProjection: (...args: unknown[]) =>
    getSubscriptionProjection(...args),
}));

describe("pollBillingStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("requires a session without revocation check", async () => {
    requireSession.mockResolvedValue({ uid: "u1" });
    getSubscriptionProjection.mockResolvedValue(null);
    const { pollBillingStatus } = await import("@/features/billing/actions");
    await pollBillingStatus();
    expect(requireSession).toHaveBeenCalledWith({ checkRevoked: false });
  });

  it("returns active only for entitled projection", async () => {
    requireSession.mockResolvedValue({ uid: "u1" });
    getSubscriptionProjection.mockResolvedValue({ status: "active" });
    const { pollBillingStatus } = await import("@/features/billing/actions");
    await expect(pollBillingStatus()).resolves.toEqual({ status: "active" });
  });

  it("returns failed for terminal failure statuses", async () => {
    requireSession.mockResolvedValue({ uid: "u1" });
    getSubscriptionProjection.mockResolvedValue({ status: "canceled" });
    const { pollBillingStatus } = await import("@/features/billing/actions");
    await expect(pollBillingStatus()).resolves.toEqual({ status: "failed" });
  });

  it("returns pending when missing or in-progress", async () => {
    requireSession.mockResolvedValue({ uid: "u1" });
    getSubscriptionProjection.mockResolvedValue(null);
    const { pollBillingStatus } = await import("@/features/billing/actions");
    await expect(pollBillingStatus()).resolves.toEqual({ status: "pending" });

    getSubscriptionProjection.mockResolvedValue({ status: "past_due" });
    await expect(pollBillingStatus()).resolves.toEqual({ status: "pending" });
  });
});
