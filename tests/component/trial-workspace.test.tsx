import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteCopy } from "@/content/site";

const replace = vi.fn();
const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace }),
}));

import { TrialWorkspace } from "@/components/documents/trial-workspace";
import {
  clearTrialDraft,
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

beforeAll(() => {
  const emptyRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON() {
      return this;
    },
  };
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => emptyRect as DOMRect;
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as unknown as DOMRectList;
  }
  Element.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as unknown as DOMRectList;
  Element.prototype.getBoundingClientRect = () => emptyRect as DOMRect;
  document.elementFromPoint = () =>
    document.querySelector("[contenteditable='true']");
});

function renderWorkspace() {
  return render(
    <TrialWorkspace
      uid="uid-trial"
      accountState={{
        kind: "logged_in",
        uid: "uid-trial",
        email: "trial@example.com",
        displayName: null,
        subscriptionActive: false,
      }}
      ctaHref="/subscribe"
    />,
  );
}

async function waitForEditor() {
  await waitFor(() => {
    expect(document.querySelector("[contenteditable='true']")).toBeTruthy();
  });
}

async function makeDirty(user: ReturnType<typeof userEvent.setup>) {
  const title = screen.getByLabelText("Document title");
  await user.clear(title);
  await user.type(title, "Dirty for sign-out");
  await user.tab();
  await waitFor(() => {
    expect(screen.getByText(siteCopy.documents.unsaved)).toBeVisible();
  });
}

describe("TrialWorkspace sign-out with unsaved changes", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    push.mockReset();
    sessionStorage.clear();
    document.cookie = "csrf_token=test-csrf-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  it("desktop AccountMenu defers sign-out through the leave modal", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await waitForEditor();
    await makeDirty(user);

    const accountTrigger = screen.getByRole("button", {
      name: /trial@example.com/,
    });
    await user.click(accountTrigger);
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByTestId("trial-leave-modal")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("trial-leave-anyway"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(replace).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
    expect(readTrialDraft("uid-trial")).toBeNull();
  });

  it("mobile Sheet AccountMenu defers sign-out through the leave modal", async () => {
    const user = userEvent.setup();
    stashTrialDraft("uid-trial", {
      title: "Sheet stash",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    renderWorkspace();
    await waitForEditor();
    await makeDirty(user);

    await user.click(screen.getByRole("button", { name: siteCopy.header.menu }));
    const sheet = await screen.findByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: /trial@example.com/ }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: siteCopy.header.signOut }),
    );

    expect(await screen.findByTestId("trial-leave-modal")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("trial-leave-anyway"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(readTrialDraft("uid-trial")).toBeNull();
    clearTrialDraft("uid-trial");
  });

  it("uses surface=app so landing Pricing is not a leave-guard entry", async () => {
    renderWorkspace();
    await waitForEditor();
    expect(screen.queryByRole("link", { name: "Pricing" })).toBeNull();
    expect(
      screen.getByRole("link", { name: siteCopy.header.cta }),
    ).toBeVisible();
  });
});
