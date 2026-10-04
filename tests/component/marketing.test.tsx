import { createElement } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) =>
    createElement(
      "a",
      {
        href,
        ...props,
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onClick?.(event);
        },
      },
      children,
    ),
}));
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";
import { siteCopy } from "@/content/site";
import type { AccountState } from "@/features/auth/account-state";

const loggedIn: AccountState = {
  kind: "logged_in",
  uid: "u1",
  email: "writer@example.com",
  displayName: null,
  subscriptionActive: false,
};

const subscriber: AccountState = {
  kind: "subscriber",
  uid: "u1",
  email: "writer@example.com",
  displayName: "Ada Writer",
  subscriptionActive: true,
};

async function openAccountMenu(
  user: ReturnType<typeof userEvent.setup>,
  label = "writer@example.com",
) {
  await user.click(
    screen.getAllByRole("button", { name: new RegExp(label) })[0]!,
  );
}

describe("SiteHeader", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = "csrf_token=test-csrf";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  it("logged out on landing: Sign in, CTA, and middle nav unchanged", () => {
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
        surface: "marketing",
      }),
    );

    expect(
      screen.getByRole("link", { name: siteCopy.header.signIn }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getAllByRole("link", { name: siteCopy.header.cta })[0],
    ).toHaveAttribute("href", "/register?next=/subscribe");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: siteCopy.header.navFaq }),
    ).toHaveAttribute("href", "/#faq");
    expect(
      screen.getByRole("link", { name: siteCopy.header.navPricing }),
    ).toHaveAttribute("href", "/#pricing");
    expect(
      screen.queryByRole("button", { name: /Account menu/i }),
    ).not.toBeInTheDocument();
  });

  it("signed in, not subscribed, landing: nav + CTA + account dropdown", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: loggedIn,
        ctaHref: "/subscribe",
        surface: "marketing",
      }),
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: siteCopy.header.cta })[0],
    ).toHaveAttribute("href", "/subscribe");
    expect(
      screen.getByRole("button", { name: /writer@example.com/ }),
    ).toHaveAccessibleName(
      `writer@example.com, ${siteCopy.header.accountMenu}`,
    );
    expect(
      screen.queryByRole("button", { name: siteCopy.header.signOut }),
    ).not.toBeInTheDocument();

    await openAccountMenu(user);
    expect(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    ).toBeInTheDocument();
  });

  it("signed in, not subscribed, editor: no landing nav, keeps CTA + dropdown", () => {
    render(
      createElement(SiteHeader, {
        accountState: loggedIn,
        ctaHref: "/subscribe",
        surface: "app",
      }),
    );

    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: siteCopy.header.cta })[0],
    ).toHaveAttribute("href", "/subscribe");
    expect(
      screen.getByRole("button", { name: /writer@example.com/ }),
    ).toBeInTheDocument();
  });

  it("subscribed, landing: Open the Editor CTA, nav, and dropdown", () => {
    render(
      createElement(SiteHeader, {
        accountState: subscriber,
        ctaHref: "/documents",
        surface: "marketing",
      }),
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: siteCopy.header.openEditor })[0],
    ).toHaveAttribute("href", "/documents");
    expect(
      screen.getByRole("button", { name: /Ada Writer/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: siteCopy.header.cta }),
    ).not.toBeInTheDocument();
  });

  it("subscribed, editor: no landing nav, no CTA, dropdown only", () => {
    render(
      createElement(SiteHeader, {
        accountState: subscriber,
        ctaHref: "/documents",
        surface: "app",
      }),
    );

    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: siteCopy.header.openEditor }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: siteCopy.header.cta }),
    ).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: /Ada Writer/ });
    expect(trigger).toBeInTheDocument();
    // Dropdown is the rightmost control in the desktop auth cluster (no CTA).
    const accountWrap = trigger.closest("span");
    expect(accountWrap?.parentElement?.lastElementChild).toBe(accountWrap);
  });

  it("account menu is keyboard accessible and signs out", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: loggedIn,
        ctaHref: "/subscribe",
        surface: "marketing",
      }),
    );

    const trigger = screen.getAllByRole("button", {
      name: /writer@example.com/,
    })[0]!;
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = await screen.findByRole("menu");
    const signOutItem = within(menu).getByRole("menuitem", {
      name: siteCopy.header.signOut,
    });
    expect(signOutItem).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    trigger.focus();
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  it("opens the mobile Sheet and exposes FAQ / pricing anchors", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const mobileNav = await screen.findByRole("dialog");
    expect(mobileNav).toHaveAttribute("id", "mobile-nav");
    expect(
      within(mobileNav).getByRole("link", { name: siteCopy.header.navFaq }),
    ).toHaveAttribute("href", "/#faq");
    expect(
      within(mobileNav).getByRole("link", { name: siteCopy.header.navPricing }),
    ).toHaveAttribute("href", "/#pricing");
    expect(
      within(mobileNav).getByRole("link", { name: siteCopy.header.signIn }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(mobileNav).getByRole("link", { name: siteCopy.header.cta }),
    ).toHaveAttribute("href", "/register?next=/subscribe");
  });

  it("closes the Sheet when the viewport widens past the mobile breakpoint", async () => {
    const user = userEvent.setup();
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const media: MediaQueryList = {
      matches: false,
      media: "(min-width: 640px)",
      addEventListener: ((
        _type: string,
        cb: EventListenerOrEventListenerObject,
      ) => {
        listener =
          typeof cb === "function"
            ? (cb as (event: MediaQueryListEvent) => void)
            : (event) => cb.handleEvent(event);
      }) as MediaQueryList["addEventListener"],
      removeEventListener: vi.fn() as MediaQueryList["removeEventListener"],
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      onchange: null,
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );

    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    Object.defineProperty(media, "matches", { value: true, configurable: true });
    await act(async () => {
      listener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("closes the Sheet when a mobile nav link is clicked", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const mobileNav = await screen.findByRole("dialog");
    await user.click(
      within(mobileNav).getByRole("link", { name: siteCopy.header.navFaq }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the Sheet from Sign in and CTA onClick handlers", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    let mobileNav = await screen.findByRole("dialog");
    await user.click(
      within(mobileNav).getByRole("link", { name: siteCopy.header.signIn }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    unmount();
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );
    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    mobileNav = await screen.findByRole("dialog");
    await user.click(
      within(mobileNav).getByRole("link", { name: siteCopy.header.cta }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to signed-in copy when email and display name are empty", () => {
    render(
      createElement(SiteHeader, {
        accountState: {
          kind: "logged_in",
          uid: "u1",
          email: "",
          displayName: null,
          subscriptionActive: false,
        },
        ctaHref: "/subscribe",
      }),
    );

    expect(
      screen.getByText(siteCopy.header.signedInFallback),
    ).toBeInTheDocument();
  });

  it("app surface mobile sheet omits landing nav links", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: subscriber,
        ctaHref: "/documents",
        surface: "app",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const mobileNav = await screen.findByRole("dialog");
    expect(
      within(mobileNav).queryByRole("link", { name: siteCopy.header.navFaq }),
    ).not.toBeInTheDocument();
    expect(
      within(mobileNav).queryByRole("link", { name: siteCopy.header.openEditor }),
    ).not.toBeInTheDocument();
    expect(
      within(mobileNav).getByRole("button", { name: /Ada Writer/ }),
    ).toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  it("links privacy, terms, and sign-in", () => {
    render(createElement(SiteFooter));
    expect(
      screen.getByRole("navigation", { name: "Footer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: siteCopy.footer.privacy }),
    ).toHaveAttribute("href", "/#privacy");
    expect(
      screen.getByRole("link", { name: siteCopy.footer.terms }),
    ).toHaveAttribute("href", "/#terms");
    expect(
      screen.getByRole("link", { name: siteCopy.header.signIn }),
    ).toHaveAttribute("href", "/login");
  });
});

describe("HeroCtaGroup", () => {
  it("routes the primary CTA and keeps the explore anchor", () => {
    render(
      createElement(HeroCtaGroup, {
        ctaHref: "/register?next=/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );

    expect(
      screen.getByRole("link", { name: siteCopy.header.cta }),
    ).toHaveAttribute("href", "/register?next=/subscribe");
    expect(
      screen.getByRole("link", { name: siteCopy.home.explore }),
    ).toHaveAttribute("href", "#benefits");
    expect(screen.getByText("€8/month · Secure checkout")).toBeInTheDocument();
  });
});

describe("SignOutButton", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = "csrf_token=test-csrf";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  it("DELETEs the session and returns home", async () => {
    const user = userEvent.setup();
    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });
});
