import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { SignOutButton } from "@/components/auth/sign-out-button";
import { siteCopy } from "@/content/site";

describe("SignOutButton failure handling", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = "csrf_token=test-csrf";
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows an alert and does not navigate when DELETE returns !ok", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })),
    );

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.networkError);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("[sign-out]");
    expect(logged).not.toContain("forbidden");
  });

  it("shows an alert and does not navigate when fetch throws", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.networkError);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
    // User-facing copy stays calm; raw exception text must not appear in the UI.
    expect(alert).not.toHaveTextContent("network down");
  });

  it("shows an alert and does not navigate when the CSRF cookie is missing", async () => {
    const user = userEvent.setup();
    document.cookie = "csrf_token=; Max-Age=0";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.networkError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
