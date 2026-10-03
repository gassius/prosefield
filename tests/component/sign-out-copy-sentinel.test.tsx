import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    ...actual,
    siteCopy: {
      ...actual.siteCopy,
      auth: {
        ...actual.siteCopy.auth,
        signOutError: "SENTINEL-SIGN-OUT",
      },
    },
  };
});

import { SignOutButton } from "@/components/auth/sign-out-button";
import { siteCopy } from "@/content/site";

describe("SignOutButton copy sentinel", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = "csrf_token=test-csrf-secret-token";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders sentinel signOutError from mocked siteCopy on !ok", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );

    render(createElement(SignOutButton));
    await user.click(
      screen.getByRole("button", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "SENTINEL-SIGN-OUT",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders sentinel signOutError when fetch throws", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );

    render(createElement(SignOutButton));
    await user.click(
      screen.getByRole("button", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "SENTINEL-SIGN-OUT",
    );
  });

  it("renders sentinel signOutError when CSRF cookie is missing", async () => {
    const user = userEvent.setup();
    document.cookie = "csrf_token=; Max-Age=0";
    vi.stubGlobal("fetch", vi.fn());

    render(createElement(SignOutButton));
    await user.click(
      screen.getByRole("button", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "SENTINEL-SIGN-OUT",
    );
  });
});
