import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const deleteDocumentAction = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/features/documents/actions", () => ({
  deleteDocumentAction: (...args: unknown[]) => deleteDocumentAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

describe("DeleteDocumentDialog", () => {
  beforeEach(() => {
    deleteDocumentAction.mockReset();
    push.mockReset();
    refresh.mockReset();
    toastSuccess.mockReset();
    deleteDocumentAction.mockResolvedValue({ ok: true, data: { id: "d1" } });
  });

  it("focuses Cancel by default when opened", async () => {
    const user = userEvent.setup();
    const { DeleteDocumentDialog } = await import(
      "@/components/documents/delete-document-dialog"
    );
    render(<DeleteDocumentDialog documentId="doc1abcABC1234567890" title="Brief" />);
    await user.click(screen.getByRole("button", { name: "Delete document" }));
    await expect
      .poll(() => document.activeElement?.textContent)
      .toBe("Cancel");
  });

  it("deletes, toasts, and navigates to /documents on success", async () => {
    const user = userEvent.setup();
    const { DeleteDocumentDialog } = await import(
      "@/components/documents/delete-document-dialog"
    );
    render(
      <DeleteDocumentDialog documentId="doc1abcABC1234567890" title="Brief" />,
    );
    await user.click(screen.getByRole("button", { name: "Delete document" }));
    const confirmButtons = await screen.findAllByRole("button", {
      name: "Delete document",
    });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => {
      expect(deleteDocumentAction).toHaveBeenCalledWith({
        documentId: "doc1abcABC1234567890",
      });
      expect(toastSuccess).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/documents");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows an alert when delete fails", async () => {
    const user = userEvent.setup();
    deleteDocumentAction.mockResolvedValue({
      ok: false,
      code: "forbidden",
      message: "Could not delete",
    });
    const { DeleteDocumentDialog } = await import(
      "@/components/documents/delete-document-dialog"
    );
    render(
      <DeleteDocumentDialog documentId="doc1abcABC1234567890" title="Brief" />,
    );
    await user.click(screen.getByRole("button", { name: "Delete document" }));
    const confirmButtons = await screen.findAllByRole("button", {
      name: "Delete document",
    });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
