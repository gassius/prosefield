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

  it("shows conflict next-step message on 409 without bouncing to /documents", async () => {
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already have a subscription/i,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /check your email from Stripe/i,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to login on 401 unauthenticated", async () => {
    const fetchMock = vi.fn(
      async (_url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers.accept).toBe("application/json");
        expect(headers["content-type"]).toBe("application/json");
        expect(JSON.parse(String(init?.body))).toEqual({
          cancelPath: "/subscribe",
        });
        return new Response(null, { status: 401 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(<CheckoutButton label="Continue to secure checkout" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?next=/subscribe");
    });
    expect(fetchMock).toHaveBeenCalled();
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

  it("falls back to generic copy when 503 body has no error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({}), {
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Could not start checkout/i,
    );
  });

  it("assigns location from JSON url on success", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    const onBeforeRedirect = vi.fn();
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
    render(
      <CheckoutButton
        label="Continue to secure checkout"
        onBeforeRedirect={onBeforeRedirect}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/cs_test",
      );
    });
    expect(onBeforeRedirect).toHaveBeenCalledTimes(1);
    expect(onBeforeRedirect.mock.invocationCallOrder[0]).toBeLessThan(
      assign.mock.invocationCallOrder[0]!,
    );
  });

  it("does not call onBeforeRedirect on 409", async () => {
    const onBeforeRedirect = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 409 })),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(
      <CheckoutButton
        label="Continue to secure checkout"
        onBeforeRedirect={onBeforeRedirect}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(onBeforeRedirect).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
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

  it("assigns location from a 303 Location header", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    const onBeforeRedirect = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 303,
            headers: {
              Location: "https://checkout.stripe.com/c/pay/cs_303",
            },
          }),
      ),
    );
    const { CheckoutButton } = await import(
      "@/components/billing/checkout-button"
    );
    render(
      <CheckoutButton
        label="Continue to secure checkout"
        onBeforeRedirect={onBeforeRedirect}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to secure checkout" }),
    );
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/cs_303",
      );
    });
    expect(onBeforeRedirect).toHaveBeenCalledTimes(1);
    expect(onBeforeRedirect.mock.invocationCallOrder[0]).toBeLessThan(
      assign.mock.invocationCallOrder[0]!,
    );
  });

  it("shows generic error when 303 has no Location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 303 })),
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
