"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentList, type DocumentListEntry } from "@/components/documents/document-list";
import { EmptyDocuments } from "@/components/documents/empty-documents";
import { siteCopy } from "@/content/site";
import { createDocumentAction } from "@/features/documents/actions";

type DocumentsWorkspaceProps = {
  documents: DocumentListEntry[];
  activeId?: string;
  children?: React.ReactNode;
};

export function DocumentsWorkspace({
  documents,
  activeId,
  children,
}: DocumentsWorkspaceProps) {
  const router = useRouter();
  const [creating, startCreate] = useTransition();

  function onCreate() {
    startCreate(async () => {
      const result = await createDocumentAction({});
      if (!result.ok) {
        return;
      }
      router.push(`/documents/${result.data.id}`);
      router.refresh();
    });
  }

  if (documents.length === 0 && !children) {
    return <EmptyDocuments onCreate={onCreate} creating={creating} />;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-72 shrink-0 md:block lg:w-80">
        <DocumentList
          documents={documents}
          activeId={activeId}
          onCreate={onCreate}
          creating={creating}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile list when no editor child */}
        {!children ? (
          <div className="md:hidden">
            <DocumentList
              documents={documents}
              activeId={activeId}
              onCreate={onCreate}
              creating={creating}
            />
          </div>
        ) : null}
        {children ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-8">
            {children}
          </div>
        ) : (
          <div className="text-muted-foreground hidden flex-1 items-center justify-center p-8 md:flex">
            <p>{siteCopy.documents.selectOrCreate}</p>
          </div>
        )}
      </div>
    </div>
  );
}
