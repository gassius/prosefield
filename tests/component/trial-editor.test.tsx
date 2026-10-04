import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteCopy } from "@/content/site";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

const push = vi.fn();
const refresh = vi.fn();
const assign = vi.fn();
const persistStashedTrialDraft = vi.fn();

const stashBehavior = vi.hoisted(() => ({
  mode: "real" as "real" | "invalid" | "unavailable",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}));

vi.mock("@/features/documents/persist-trial-draft", () => ({
  persistStashedTrialDraft: (...args: unknown[]) =>
    persistStashedTrialDraft(...args),
}));

vi.mock("@/features/documents/trial-draft-stash", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/documents/trial-draft-stash")
  >("@/features/documents/trial-draft-stash");
  return {
    ...actual,
    stashTrialDraft: (
      ...args: Parameters<typeof actual.stashTrialDraft>
    ) => {
      if (stashBehavior.mode === "invalid") {
        return { ok: false, reason: "invalid" as const };
      }
      if (stashBehavior.mode === "unavailable") {
        return { ok: false, reason: "unavailable" as const };
      }
      return actual.stashTrialDraft(...args);
    },
  };
});

import { TrialWorkspace } from "@/components/documents/trial-workspace";
import {
  clearTrialDraft,
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";

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

  if (typeof DataTransfer === "undefined") {
    class DataTransferStub {
      private data = new Map<string, string>();
      setData(format: string, value: string) {
        this.data.set(format, value);
      }
      getData(format: string) {
        return this.data.get(format) ?? "";
      }
      get types() {
        return [...this.data.keys()];
      }
      files = [] as unknown as FileList;
      items = [] as unknown as DataTransferItemList;
      dropEffect = "none" as DataTransfer["dropEffect"];
      effectAllowed = "all" as DataTransfer["effectAllowed"];
      clearData() {
        this.data.clear();
      }
      setDragImage() {}
    }
    globalThis.DataTransfer = DataTransferStub as unknown as typeof DataTransfer;
  }
});

async function waitForEditor() {
  await waitFor(() => {
    expect(document.querySelector("[contenteditable='true']")).toBeTruthy();
  });
}

function renderTrial() {
  return render(
    <TrialWorkspace
      uid="uid-trial"
      accountState={{
        kind: "logged_in",
        uid: "uid-trial",
        email: "trial@example.com",
        subscriptionActive: false,
      }}
      ctaHref="/subscribe"
    />,
  );
}

function dispatchBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", {
    cancelable: true,
  }) as BeforeUnloadEvent;
  Object.defineProperty(event, "returnValue", {
    configurable: true,
    writable: true,
    value: "",
  });
  window.dispatchEvent(event);
  return event;
}

describe("TrialEditor locks and leave guard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
    refresh.mockReset();
    assign.mockReset();
    persistStashedTrialDraft.mockReset();
    stashBehavior.mode = "real";
    vi.unstubAllGlobals();
  });

  it("shows trial-not-saved copy instead of green Saved on a clean doc", async () => {
    renderTrial();
    await waitForEditor();
    expect(screen.getByTestId("trial-new-document-mobile")).toBeInTheDocument();
    expect(screen.getByText(siteCopy.documents.trialNotSaved)).toBeVisible();
    expect(screen.queryByText(siteCopy.documents.saved)).toBeNull();
  });

  it("opens subscribe modal from Save, New, Delete, and Cmd/Ctrl+S", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).not.toBeDisabled();
    await user.click(save);
    expect(await screen.findByTestId("trial-subscribe-modal")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /Subscribe to keep writing/i }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByTestId("trial-subscribe-modal")).toBeNull();
    });

    await user.click(screen.getByTestId("trial-new-document"));
    expect(await screen.findByTestId("trial-subscribe-modal")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByTestId("trial-delete-document"));
    expect(await screen.findByTestId("trial-subscribe-modal")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.keyboard("{Control>}s{/Control}");
    expect(await screen.findByTestId("trial-subscribe-modal")).toBeVisible();
  });

  it("opens subscribe modal from the mobile New action", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    await user.click(screen.getByTestId("trial-new-document-mobile"));
    expect(await screen.findByTestId("trial-subscribe-modal")).toBeVisible();
  });

  it("allows rename and typing without calling server actions", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Renamed trial");
    await user.tab();
    expect(title).toHaveValue("Renamed trial");
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement;
    await user.click(editable);
    await user.keyboard("Hello funnel");
    expect(editable).toHaveTextContent(/Hello funnel/);
    expect(persistStashedTrialDraft).not.toHaveBeenCalled();
  });

  it("registers beforeunload only when dirty and disarms after stash for checkout", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();

    const cleanEvent = dispatchBeforeUnload();
    expect(cleanEvent.defaultPrevented).toBe(false);

    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Dirty unload");
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText(siteCopy.documents.unsaved)).toBeVisible();
    });

    const dirtyEvent = dispatchBeforeUnload();
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const modal = await screen.findByTestId("trial-subscribe-modal");
    await user.click(
      within(modal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    await waitFor(() => {
      expect(assign).toHaveBeenCalled();
    });

    const afterStash = dispatchBeforeUnload();
    expect(afterStash.defaultPrevented).toBe(false);
  });

  it("stashes draft by uid before checkout from subscribe modal with cancelPath trial", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        cancelPath: "/documents/trial",
      });
      return new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Stash me");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const modal = await screen.findByTestId("trial-subscribe-modal");
    await user.click(
      within(modal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    await waitFor(() => {
      expect(readTrialDraft("uid-trial")?.title).toBe("Stash me");
      expect(readTrialDraft("uid-other")).toBeNull();
      expect(assign).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("leave modal Continue to checkout stashes with cancelPath /documents/trial", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        cancelPath: "/documents/trial",
      });
      return new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Leave stash");
    await user.tab();

    await user.click(screen.getByRole("link", { name: "Pricing" }));
    const leaveModal = await screen.findByTestId("trial-leave-modal");
    await user.click(
      within(leaveModal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    await waitFor(() => {
      expect(readTrialDraft("uid-trial")?.title).toBe("Leave stash");
      expect(assign).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("navigates immediately when clean (guard only when dirty)", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();
    await user.click(screen.getByRole("link", { name: "Pricing" }));
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();
  });

  it("closes the leave modal via Cancel (onOpenChange)", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Cancel leave");
    await user.tab();
    await user.click(screen.getByRole("link", { name: "Pricing" }));
    expect(await screen.findByTestId("trial-leave-modal")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByTestId("trial-leave-modal")).toBeNull();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("leave-anyway discards stash, navigates, and does not re-arm beforeunload", async () => {
    stashTrialDraft("uid-trial", {
      title: "Discard me",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Dirty now");
    await user.tab();

    await user.click(screen.getByRole("link", { name: "Pricing" }));
    expect(await screen.findByTestId("trial-leave-modal")).toBeVisible();
    await user.click(screen.getByTestId("trial-leave-anyway"));
    await waitFor(() => {
      expect(readTrialDraft("uid-trial")).toBeNull();
      expect(push).toHaveBeenCalledWith("/#pricing");
    });
    const afterLeave = dispatchBeforeUnload();
    expect(afterLeave.defaultPrevented).toBe(false);
    clearTrialDraft("uid-trial");
  });

  it("commits title on Enter and restores blank titles to Untitled", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Enter title");
    await user.keyboard("{Enter}");
    expect(title).toHaveValue("Enter title");
    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue("Untitled document");
    expect(screen.getByText(siteCopy.documents.unsaved)).toBeVisible();
  });

  it("ignores hash, mailto, and self trial links while dirty", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Stay put");
    await user.tab();

    const hash = document.createElement("a");
    hash.setAttribute("href", "#faq");
    hash.textContent = "Hash";
    document.body.appendChild(hash);
    await user.click(hash);
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();

    const mail = document.createElement("a");
    mail.setAttribute("href", "mailto:hi@example.com");
    mail.textContent = "Mail";
    document.body.appendChild(mail);
    await user.click(mail);
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();

    const self = document.createElement("a");
    self.setAttribute("href", "/documents/trial");
    self.textContent = "Self";
    document.body.appendChild(self);
    await user.click(self);
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();

    // Non-Element target is ignored by the leave interceptor.
    document.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    hash.remove();
    mail.remove();
    self.remove();
  });

  it("no-ops title commit when the committed title is unchanged", async () => {
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Same");
    await user.tab();
    expect(screen.getByText(siteCopy.documents.unsaved)).toBeVisible();
    await user.click(title);
    await user.tab();
    expect(title).toHaveValue("Same");
  });

  it("loads an initialDraft prop when provided", async () => {
    const { TrialEditor } = await import("@/components/documents/trial-editor");
    const { UnsavedLeaveGuardProvider } = await import(
      "@/components/documents/unsaved-leave-guard"
    );
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    render(
      <UnsavedLeaveGuardProvider>
        <TrialEditor
          uid="uid-trial"
          initialDraft={{
            title: "From prop",
            content: EMPTY_DOCUMENT_CONTENT,
          }}
        />
      </UnsavedLeaveGuardProvider>,
    );
    await waitForEditor();
    expect(screen.getByLabelText("Document title")).toHaveValue("From prop");
  });

  it("works without a leave-guard provider (optional chaining)", async () => {
    const { TrialEditor } = await import("@/components/documents/trial-editor");
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    render(
      <TrialEditor
        uid="uid-trial"
        initialDraft={{
          title: "No guard",
          content: EMPTY_DOCUMENT_CONTENT,
        }}
      />,
    );
    await waitForEditor();
    expect(screen.getByLabelText("Document title")).toHaveValue("No guard");
    // Dirty navigation with no provider must not throw.
    const link = document.createElement("a");
    link.setAttribute("href", "/#pricing");
    link.textContent = "Go";
    document.body.appendChild(link);
    const user = userEvent.setup();
    await user.click(link);
    expect(screen.queryByTestId("trial-leave-modal")).toBeNull();
    link.remove();
  });

  it("stashes Untitled when the title input is cleared but not committed", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    // Do not blur — exercise title.trim() || DEFAULT in currentDraft.
    await user.click(screen.getByRole("button", { name: "Save" }));
    const modal = await screen.findByTestId("trial-subscribe-modal");
    await user.click(
      within(modal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    await waitFor(() => {
      expect(readTrialDraft("uid-trial")?.title).toBe("Untitled document");
      expect(assign).toHaveBeenCalled();
    });
  });

  it("blocks checkout and shows an error when stash validation fails", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    stashBehavior.mode = "invalid";
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();

    await user.click(screen.getByRole("button", { name: "Save" }));
    const modal = await screen.findByTestId("trial-subscribe-modal");
    await user.click(
      within(modal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    expect(await screen.findByTestId("trial-draft-error")).toHaveTextContent(
      siteCopy.documents.trialDraftInvalid,
    );
    expect(assign).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks checkout when sessionStorage stash is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    stashBehavior.mode = "unavailable";
    const user = userEvent.setup();
    renderTrial();
    await waitForEditor();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const modal = await screen.findByTestId("trial-subscribe-modal");
    await user.click(
      within(modal).getByRole("button", {
        name: "Continue to secure checkout",
      }),
    );
    expect(await screen.findByTestId("trial-draft-error")).toHaveTextContent(
      siteCopy.subscribe.checkoutError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
