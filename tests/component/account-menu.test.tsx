import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { AccountMenu } from "@/components/auth/account-menu";
import { siteCopy } from "@/content/site";

describe("AccountMenu", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = "csrf_token=test-csrf";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens with Space and signs out from the menuitem", async () => {
    const user = userEvent.setup();
    render(createElement(AccountMenu, { label: "writer@example.com" }));

    const trigger = screen.getByRole("button", {
      name: siteCopy.header.accountMenu,
    });
    trigger.focus();
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(replace).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows an alert when sign-out fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(createElement(AccountMenu, { label: "writer@example.com" }));
    await user.click(
      screen.getByRole("button", { name: siteCopy.header.accountMenu }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      siteCopy.auth.signOutError,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("decodes CSRF cookie values that contain '='", async () => {
    const user = userEvent.setup();
    document.cookie = `csrf_token=${encodeURIComponent("a=b=c")}`;
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(AccountMenu, { label: "writer@example.com" }));
    await user.click(
      screen.getByRole("button", { name: siteCopy.header.accountMenu }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-csrf-token": "a=b=c" }),
        }),
      );
    });
  });
});
