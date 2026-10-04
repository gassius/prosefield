import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrialWorkspace } from "@/components/documents/trial-workspace";
import {
  clearTrialDraft,
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

const push = vi.fn();
const refresh = vi.fn();
const assign = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}));

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

describe("TrialEditor locks and leave guard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
    refresh.mockReset();
    assign.mockReset();
    vi.unstubAllGlobals();
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
  });

  it("stashes draft by uid before checkout from subscribe modal", async () => {
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
    });
  });

  it("leave-anyway discards stash and runs pending navigation", async () => {
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

    // Click a header nav link while dirty.
    await user.click(screen.getByRole("link", { name: "Pricing" }));
    expect(await screen.findByTestId("trial-leave-modal")).toBeVisible();
    await user.click(screen.getByTestId("trial-leave-anyway"));
    await waitFor(() => {
      expect(readTrialDraft("uid-trial")).toBeNull();
      expect(push).toHaveBeenCalledWith("/#pricing");
    });
    clearTrialDraft("uid-trial");
  });
});
