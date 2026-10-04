import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act, waitFor } from "@testing-library/react";

const replace = vi.fn();
const pollBillingStatus = vi.fn();
const persistStashedTrialDraft = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/features/billing/actions", () => ({
  pollBillingStatus: () => pollBillingStatus(),
}));

vi.mock("@/features/documents/persist-trial-draft", () => ({
  persistStashedTrialDraft: (...args: unknown[]) =>
    persistStashedTrialDraft(...args),
}));

describe("BillingStatusClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows pending copy then delayed after the poll window", async () => {
    vi.useFakeTimers();
    pollBillingStatus.mockResolvedValue({ status: "pending" });
    persistStashedTrialDraft.mockResolvedValue({ ok: false, reason: "none" });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="pending" uid="uid-1" />);
    expect(
      screen.getByText("Confirming your payment with Stripe…"),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(32_000);
    });

    expect(
      screen.getByText(/still waiting for Stripe to confirm your payment/i),
    ).toBeInTheDocument();
  });

  it("shows failed panel with Try again", async () => {
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="failed" uid="uid-1" />);
    expect(
      screen.getByRole("heading", { name: "Payment didn't go through" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("redirects when poll reports active", async () => {
    vi.useFakeTimers();
    pollBillingStatus.mockResolvedValue({ status: "active" });
    persistStashedTrialDraft.mockResolvedValue({ ok: false, reason: "none" });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="pending" uid="uid-1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(persistStashedTrialDraft).toHaveBeenCalledWith("uid-1");
    expect(replace).toHaveBeenCalledWith("/documents");
  });

  it("restores stashed trial draft into the editor when active", async () => {
    persistStashedTrialDraft.mockResolvedValue({
      ok: true,
      documentId: "docRestored1234567890",
    });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="active" uid="uid-1" />);
    await waitFor(() => {
      expect(persistStashedTrialDraft).toHaveBeenCalledWith("uid-1");
      expect(replace).toHaveBeenCalledWith("/documents/docRestored1234567890");
    });
  });

  it("switches pending to failed when poll reports failed", async () => {
    vi.useFakeTimers();
    pollBillingStatus.mockResolvedValue({ status: "failed" });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="pending" uid="uid-1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(
      screen.getByRole("heading", { name: "Payment didn't go through" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
