import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const deleteDocumentAction = vi.fn();

vi.mock("@/features/documents/actions", () => ({
  deleteDocumentAction: (...args: unknown[]) => deleteDocumentAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

describe("DeleteDocumentDialog", () => {
  beforeEach(() => {
    deleteDocumentAction.mockReset();
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
});
