import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
const assign = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("CheckoutButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("redirects to /documents on 409 already active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 409 })),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(<CheckoutButton label="Continue to secure checkout" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents");
    });
  });

  it("shows not-configured error from 503 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Billing is not configured." }), {
            status: 503,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(<CheckoutButton label="Continue to secure checkout" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Billing is not configured.");
  });

  it("assigns location from JSON url on success", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(<CheckoutButton label="Continue to secure checkout" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/cs_test",
      );
    });
  });

  it("shows generic error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(<CheckoutButton label="Continue to secure checkout" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Could not start checkout/i,
    );
  });
});
