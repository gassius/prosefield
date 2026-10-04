import { createElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { AccountMenu } from "@/components/auth/account-menu";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteCopy } from "@/content/site";

const LABEL = "writer@example.com";

function accountTriggerName(label: string): RegExp {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

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

  it("accessible name includes the visible label (WCAG 2.5.3)", () => {
    render(createElement(AccountMenu, { label: LABEL }));
    const trigger = screen.getByRole("button", {
      name: accountTriggerName(LABEL),
    });
    expect(trigger).toHaveAccessibleName(
      `${LABEL}, ${siteCopy.header.accountMenu}`,
    );
  });

  it("opens with Space and signs out from the menuitem", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        "header",
        null,
        createElement(AccountMenu, { label: LABEL }),
      ),
    );

    const trigger = screen.getByRole("button", {
      name: accountTriggerName(LABEL),
    });
    trigger.focus();
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Bites when modal={true}: Radix hideOthers wraps the tree in aria-hidden.
    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
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

  it("opens with ArrowDown and closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        "div",
        null,
        createElement(AccountMenu, { label: LABEL }),
        createElement("button", { type: "button" }, "Outside"),
      ),
    );

    const trigger = screen.getByRole("button", {
      name: accountTriggerName(LABEL),
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an alert when sign-out fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(createElement(AccountMenu, { label: LABEL }));
    await user.click(
      screen.getByRole("button", { name: accountTriggerName(LABEL) }),
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

    render(createElement(AccountMenu, { label: LABEL }));
    await user.click(
      screen.getByRole("button", { name: accountTriggerName(LABEL) }),
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

describe("AccountMenu inside SiteHeader Sheet", () => {
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
  });

  it("signs out from the account menu inside the mobile Sheet", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: {
          kind: "logged_in",
          uid: "u1",
          email: LABEL,
          displayName: null,
          subscriptionActive: false,
        },
        ctaHref: "/subscribe",
        surface: "app",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const sheet = await screen.findByRole("dialog");
    const trigger = within(sheet).getByRole("button", {
      name: accountTriggerName(LABEL),
    });
    await user.click(trigger);
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
});
