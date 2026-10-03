import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { SignOutButton } from "@/components/auth/sign-out-button";
import { siteCopy } from "@/content/site";

const CSRF_VALUE = "test-csrf-secret-token";
const RESPONSE_BODY_SECRET = "forbidden-body-secret";
const THROW_MESSAGE_SECRET = "network-down-secret";

/** Deep-walk logged args so object payloads can't hide secrets behind String(). */
function collectLoggedStrings(value: unknown, out: string[] = []): string[] {
  if (value === null || value === undefined) {
    return out;
  }
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    out.push(String(value));
    return out;
  }
  if (typeof value === "symbol") {
    out.push(value.toString());
    return out;
  }
  if (typeof value === "function") {
    out.push(value.name || "anonymous");
    return out;
  }
  if (value instanceof Error) {
    out.push(value.name, value.message, value.stack ?? "");
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLoggedStrings(item, out);
    }
    return out;
  }
  if (typeof value === "object") {
    out.push(JSON.stringify(value));
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      collectLoggedStrings(nested, out);
    }
  }
  return out;
}

function assertNoSecretsInLogs(consoleError: MockInstance<typeof console.error>) {
  const leaked = [RESPONSE_BODY_SECRET, THROW_MESSAGE_SECRET, CSRF_VALUE];
  for (const args of consoleError.mock.calls) {
    const strings = collectLoggedStrings(args);
    for (const secret of leaked) {
      expect(strings.join("\u0000")).not.toContain(secret);
    }
  }
}

describe("SignOutButton failure handling", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = `csrf_token=${CSRF_VALUE}`;
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
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: RESPONSE_BODY_SECRET }), { status: 403 }),
      ),
    );

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.signOutError);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[sign-out]", {
      event: "sign_out_failed",
      reason: "http",
      status: 403,
    });
    assertNoSecretsInLogs(consoleError);
  });

  it("shows an alert and does not navigate when fetch throws", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(THROW_MESSAGE_SECRET);
      }),
    );

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.signOutError);
    expect(alert).not.toHaveTextContent(THROW_MESSAGE_SECRET);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("[sign-out]", {
        event: "sign_out_failed",
        reason: "network",
      });
    });
    assertNoSecretsInLogs(consoleError);
  });

  it("shows an alert and does not navigate when the CSRF cookie is missing", async () => {
    const user = userEvent.setup();
    document.cookie = "csrf_token=; Max-Age=0";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(siteCopy.auth.signOutError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[sign-out]", {
      event: "sign_out_failed",
      reason: "csrf",
    });
    assertNoSecretsInLogs(consoleError);
  });

  it("re-enables after failure and clears the alert on a successful retry", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: RESPONSE_BODY_SECRET }), { status: 500 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(SignOutButton));
    const button = screen.getByRole("button", { name: siteCopy.header.signOut });

    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(siteCopy.auth.signOutError);
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    await user.click(button);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    assertNoSecretsInLogs(consoleError);
  });
});
