import { createElement, useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  UnsavedLeaveGuardProvider,
  useUnsavedLeaveGuard,
} from "@/components/documents/unsaved-leave-guard";
import { siteCopy } from "@/content/site";
import {
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

function DirtySignOutHarness({
  onReady,
}: {
  onReady?: (confirmLeaveAnyway: () => void) => void;
}) {
  const guard = useUnsavedLeaveGuard();
  useEffect(() => {
    guard?.setDirty(true);
    if (guard) {
      onReady?.(() => guard.confirmLeaveAnyway());
    }
  }, [guard, onReady]);
  return createElement(SignOutButton);
}

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
    sessionStorage.clear();
    stashTrialDraft("uid-keep", {
      title: "Keep on failed sign-out",
      content: EMPTY_DOCUMENT_CONTENT,
    });
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
    // Failed sign-out must not wipe drafts (kills O6).
    expect(readTrialDraft("uid-keep")?.title).toBe("Keep on failed sign-out");
    expect(consoleError).toHaveBeenCalledWith("[sign-out]", {
      event: "sign_out_failed",
      reason: "http",
      status: 403,
    });
    assertNoSecretsInLogs(consoleError);
    sessionStorage.clear();
  });

  it("shows an alert and does not navigate when fetch throws", async () => {
    const user = userEvent.setup();
    sessionStorage.clear();
    stashTrialDraft("uid-keep-net", {
      title: "Keep on network fail",
      content: EMPTY_DOCUMENT_CONTENT,
    });
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
    expect(readTrialDraft("uid-keep-net")?.title).toBe("Keep on network fail");
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("[sign-out]", {
        event: "sign_out_failed",
        reason: "network",
      });
    });
    assertNoSecretsInLogs(consoleError);
    sessionStorage.clear();
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

  it("clears every trial draft stash after a successful sign-out (no trialUid prop)", async () => {
    const user = userEvent.setup();
    sessionStorage.clear();
    stashTrialDraft("uid-signout", {
      title: "Clear on sign out",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    stashTrialDraft("uid-other", {
      title: "Also clear",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(readTrialDraft("uid-signout")).not.toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    // No trialUid — clearing must be unconditional (subscribe/billing/landing/documents).
    render(createElement(SignOutButton));
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(readTrialDraft("uid-signout")).toBeNull();
    expect(readTrialDraft("uid-other")).toBeNull();
    sessionStorage.clear();
  });
});

describe("SignOutButton leave-guard integration", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    document.cookie = `csrf_token=${CSRF_VALUE}`;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers sign-out through the leave guard when the trial draft is dirty", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    let confirmLeave: (() => void) | undefined;

    render(
      createElement(
        UnsavedLeaveGuardProvider,
        null,
        createElement(DirtySignOutHarness, {
          onReady: (confirm) => {
            confirmLeave = confirm;
          },
        }),
      ),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: siteCopy.header.signOut })).toBeEnabled();
      expect(confirmLeave).toBeTypeOf("function");
    });
    await user.click(screen.getByRole("button", { name: siteCopy.header.signOut }));
    // Leave guard should intercept before fetch.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    // Confirming leave runs the deferred performSignOut callback.
    confirmLeave?.();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/");
    });
  });
});
