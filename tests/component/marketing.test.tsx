import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
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
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
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

  it("opens the mobile menu and exposes FAQ / pricing anchors", async () => {
    const user = userEvent.setup();
    render(
      createElement(SiteHeader, {
        accountState: { kind: "logged_out" },
        ctaHref: "/register?next=/subscribe",
      }),
    );

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const mobileNav = document.getElementById("mobile-nav");
    expect(mobileNav).not.toBeNull();
    expect(
      within(mobileNav!).getByRole("link", { name: siteCopy.header.navFaq }),
    ).toHaveAttribute("href", "/#faq");
    expect(
      within(mobileNav!).getByRole("link", { name: siteCopy.header.navPricing }),
    ).toHaveAttribute("href", "/#pricing");
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
