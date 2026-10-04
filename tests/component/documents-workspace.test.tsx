import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
const createDocumentAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/features/documents/actions", () => ({
  createDocumentAction: (...args: unknown[]) => createDocumentAction(...args),
}));

describe("DocumentsWorkspace", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    createDocumentAction.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state and navigates after create", async () => {
    const user = userEvent.setup();
    createDocumentAction.mockResolvedValue({
      ok: true,
      data: { id: "newDocWorkspace123456" },
    });
    const { DocumentsWorkspace } = await import(
      "@/components/documents/documents-workspace"
    );
    render(<DocumentsWorkspace documents={[]} />);
    expect(
      screen.getByRole("heading", { name: "Your first page is waiting." }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New document" }));
    await waitFor(() => {
      expect(createDocumentAction).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/documents/newDocWorkspace123456");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("renders the list, select prompt, and editor children", async () => {
    const { DocumentsWorkspace } = await import(
      "@/components/documents/documents-workspace"
    );
    const { rerender } = render(
      <DocumentsWorkspace
        documents={[
          {
            id: "doc1",
            title: "One",
            updatedAt: "2026-10-02T11:58:00Z",
          },
        ]}
        activeId="doc1"
      />,
    );
    expect(screen.getAllByText("One").length).toBeGreaterThan(0);
    // Desktop-only prompt is `hidden` in jsdom (no md breakpoint).
    expect(
      screen.getByText("Select a document or create a new one."),
    ).toBeInTheDocument();

    rerender(
      <DocumentsWorkspace
        documents={[
          {
            id: "doc1",
            title: "One",
            updatedAt: "2026-10-02T11:58:00Z",
          },
        ]}
        activeId="doc1"
      >
        <p>Editor child</p>
      </DocumentsWorkspace>,
    );
    expect(screen.getByText("Editor child")).toBeVisible();
  });

  it("does not navigate when create fails", async () => {
    const user = userEvent.setup();
    createDocumentAction.mockResolvedValue({
      ok: false,
      code: "forbidden",
      message: "nope",
    });
    const { DocumentsWorkspace } = await import(
      "@/components/documents/documents-workspace"
    );
    render(<DocumentsWorkspace documents={[]} />);
    await user.click(screen.getByRole("button", { name: "New document" }));
    await waitFor(() => {
      expect(createDocumentAction).toHaveBeenCalled();
    });
    expect(push).not.toHaveBeenCalled();
  });
});
