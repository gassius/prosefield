import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";

const replace = vi.fn();
const pollBillingStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/features/billing/actions", () => ({
  pollBillingStatus: () => pollBillingStatus(),
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
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="pending" />);
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
    render(<BillingStatusClient initialView="failed" />);
    expect(
      screen.getByRole("heading", { name: "Payment didn't go through" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("redirects when poll reports active", async () => {
    vi.useFakeTimers();
    pollBillingStatus.mockResolvedValue({ status: "active" });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="pending" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(replace).toHaveBeenCalledWith("/documents");
  });
});
