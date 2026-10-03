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

  it("shows Sign in when logged out and routes CTA to register", () => {
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
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
  });

  it("shows email and Sign out when logged in", () => {
    render(
      createElement(SiteHeader, {
        accountState: {
          kind: "logged_in",
          uid: "u1",
          email: "writer@example.com",
          subscriptionActive: false,
        },
        ctaHref: "/subscribe",
      }),
    );

    expect(screen.getByText("writer@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: siteCopy.header.signOut }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: siteCopy.header.cta })[0],
    ).toHaveAttribute("href", "/subscribe");
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

  it("falls back to signed-in copy when email is empty", () => {
    render(
      createElement(SiteHeader, {
        accountState: {
          kind: "logged_in",
          uid: "u1",
          email: "",
          subscriptionActive: false,
        },
        ctaHref: "/subscribe",
      }),
    );

    expect(
      screen.getByText(siteCopy.header.signedInFallback),
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
