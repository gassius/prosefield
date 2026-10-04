import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    expect(persistStashedTrialDraft).not.toHaveBeenCalled();
  });

  it("shows failed panel with Try again and never persists", async () => {
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="failed" uid="uid-1" />);
    expect(
      screen.getByRole("heading", { name: "Payment didn't go through" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(persistStashedTrialDraft).not.toHaveBeenCalled();
  });

  it("redirects when poll reports active and there is no stash", async () => {
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

  it("shows persist-failed retry UI and keeps trying until success", async () => {
    const user = userEvent.setup();
    let fail = true;
    persistStashedTrialDraft.mockImplementation(async () => {
      if (fail) {
        return { ok: false, reason: "create_failed" };
      }
      return {
        ok: true,
        documentId: "docRetry1234567890abcd",
      };
    });
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="active" uid="uid-1" />);
    expect(await screen.findByTestId("trial-persist-failed")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /couldn’t save your draft/i }),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();

    fail = false;
    await user.click(screen.getByTestId("trial-persist-retry"));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents/docRetry1234567890abcd");
    });
  });

  it("surfaces persist-failed when persist throws so the spinner never hangs", async () => {
    persistStashedTrialDraft.mockRejectedValue(new Error("network"));
    const { BillingStatusClient } = await import(
      "@/app/(account)/billing/status/billing-status-client"
    );
    render(<BillingStatusClient initialView="active" uid="uid-1" />);
    expect(await screen.findByTestId("trial-persist-failed")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches pending to failed when poll reports failed without persisting", async () => {
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
    expect(persistStashedTrialDraft).not.toHaveBeenCalled();
  });
});
