import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const getDocumentById = vi.fn();
const listDocumentsForOwner = vi.fn();
const requireSessionOrRedirect = vi.fn();
const getAccountState = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/features/auth/guards", () => ({
  requireSessionOrRedirect: () => requireSessionOrRedirect(),
  getAccountState: () => getAccountState(),
  ctaDestinationForState: () => "/documents",
}));

vi.mock("@/features/documents/repository", () => ({
  getDocumentById: (id: string) => getDocumentById(id),
  listDocumentsForOwner: (uid: string) => listDocumentsForOwner(uid),
}));

vi.mock("@/features/billing/plan", () => ({
  getPlan: vi.fn(async () => ({
    priceLabel: "€8 /month",
    checkoutReassurance: "€8/month · Secure checkout",
  })),
}));

vi.mock("@/components/marketing/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/documents/documents-workspace", () => ({
  DocumentsWorkspace: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/editor/document-editor", () => ({
  DocumentEditor: () => null,
}));

describe("DocumentPage documentId gate (finding 14)", () => {
  beforeEach(() => {
    vi.resetModules();
    notFound.mockClear();
    getDocumentById.mockReset();
    listDocumentsForOwner.mockReset();
    requireSessionOrRedirect.mockReset();
    getAccountState.mockReset();

    requireSessionOrRedirect.mockResolvedValue({
      kind: "subscriber",
      uid: "owner-1",
      email: "owner@example.com",
      subscriptionActive: true,
    });
    getAccountState.mockResolvedValue({
      kind: "subscriber",
      uid: "owner-1",
      email: "owner@example.com",
      subscriptionActive: true,
    });
  });

  it("notFound() for encoded slash id a%2Fb and never calls getDocumentById", async () => {
    // Next 16.3.7 hands the page params.documentId as the undecoded "a%2Fb"
    // (not "a/b"). Admin accepts doc("a%2Fb"), so without documentIdSchema the
    // page would look up a miss and still 404 — this test is the bite.
    const DocumentPage = (
      await import("@/app/(workspace)/documents/[documentId]/page")
    ).default;

    await expect(
      DocumentPage({ params: Promise.resolve({ documentId: "a%2Fb" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getDocumentById).not.toHaveBeenCalled();
  });
});
