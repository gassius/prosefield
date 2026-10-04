import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
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

const signIn = vi.fn();
const signOut = vi.fn();
const getIdToken = vi.fn();
const registerAction = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: vi.fn(async () => ({})),
}));

vi.mock("@/features/auth/register", () => ({
  registerAction: (...args: unknown[]) => registerAction(...args),
}));

import { AuthForm } from "@/components/auth/auth-form";
import { siteCopy } from "@/content/site";

describe("AuthForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signIn.mockReset();
    signOut.mockReset();
    getIdToken.mockReset();
    registerAction.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    document.cookie = "csrf_token=test-csrf";
  });

  it("renders register labels and password hint", () => {
    render(createElement(AuthForm, { mode: "register", nextPath: "/subscribe" }));
    expect(
      screen.getByRole("heading", { name: siteCopy.auth.registerTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(siteCopy.auth.passwordHint)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: siteCopy.auth.registerSubmit }),
    ).toBeInTheDocument();
  });

  it("registers via server Action, signs in, exchanges session, and navigates", async () => {
    const user = userEvent.setup();
    registerAction.mockResolvedValue({ ok: true });
    getIdToken.mockResolvedValue("id-token");
    signIn.mockResolvedValue({
      user: { getIdToken },
    });
    signOut.mockResolvedValue(undefined);

    render(createElement(AuthForm, { mode: "register", nextPath: "/subscribe" }));

    await user.type(screen.getByLabelText(siteCopy.auth.emailLabel), "new@example.com");
    await user.type(screen.getByLabelText(siteCopy.auth.passwordLabel), "password-123");
    await user.click(
      screen.getByRole("button", { name: siteCopy.auth.registerSubmit }),
    );

    expect(registerAction).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password-123",
    });
    expect(signIn).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/subscribe");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a generic summary error for duplicate email (no enumeration)", async () => {
    const user = userEvent.setup();
    registerAction.mockResolvedValue({
      ok: false,
      message: siteCopy.auth.genericError,
    });

    render(createElement(AuthForm, { mode: "register", nextPath: "/subscribe" }));
    await user.type(screen.getByLabelText(siteCopy.auth.emailLabel), "dup@example.com");
    await user.type(screen.getByLabelText(siteCopy.auth.passwordLabel), "password-123");
    await user.click(
      screen.getByRole("button", { name: siteCopy.auth.registerSubmit }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      siteCopy.auth.genericError,
    );
    expect(signIn).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a generic summary error for unknown credentials on login", async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValue({ code: "auth/invalid-credential" });

    render(createElement(AuthForm, { mode: "login", nextPath: "/subscribe" }));
    await user.type(screen.getByLabelText(siteCopy.auth.emailLabel), "missing@example.com");
    await user.type(screen.getByLabelText(siteCopy.auth.passwordLabel), "wrong-pass");
    await user.click(screen.getByRole("button", { name: siteCopy.auth.loginSubmit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      siteCopy.auth.genericError,
    );
  });

  it("shows a password field error when the server Action maps weak-password", async () => {
    const user = userEvent.setup();
    registerAction.mockResolvedValue({
      ok: false,
      field: "password",
      message: siteCopy.auth.passwordHint,
    });

    render(createElement(AuthForm, { mode: "register", nextPath: "/subscribe" }));
    await user.type(screen.getByLabelText(siteCopy.auth.emailLabel), "weak@example.com");
    await user.type(screen.getByLabelText(siteCopy.auth.passwordLabel), "12345678");
    await user.click(
      screen.getByRole("button", { name: siteCopy.auth.registerSubmit }),
    );

    expect(await screen.findByText(siteCopy.auth.passwordHint)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("rejects a 7-character password before calling the server Action", async () => {
    const user = userEvent.setup();
    render(createElement(AuthForm, { mode: "register", nextPath: "/subscribe" }));

    const passwordInput = screen.getByLabelText(siteCopy.auth.passwordLabel);
    expect(passwordInput).toHaveAttribute("minLength", "8");

    await user.type(screen.getByLabelText(siteCopy.auth.emailLabel), "short@example.com");
    await user.type(passwordInput, "abcdefg");
    await user.click(
      screen.getByRole("button", { name: siteCopy.auth.registerSubmit }),
    );

    expect(await screen.findByText(siteCopy.auth.passwordHint)).toBeInTheDocument();
    expect(registerAction).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});
