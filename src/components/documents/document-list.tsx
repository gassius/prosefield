"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import {
  formatEditedAccessible,
  formatEditedLabel,
} from "@/features/documents/format-time";
import { cn } from "@/lib/utils";

export type DocumentListEntry = {
  id: string;
  title: string;
  updatedAt: string;
};

type DocumentListProps = {
  documents: DocumentListEntry[];
  activeId?: string;
  onCreate: () => void;
  creating?: boolean;
  className?: string;
  now?: Date;
};

export function DocumentList({
  documents,
  activeId,
  onCreate,
  creating = false,
  className,
  now,
}: DocumentListProps) {
  const reference = now ?? new Date();

  return (
    <aside
      className={cn(
        "border-border flex h-full w-full flex-col border-r bg-secondary/40 p-4",
        className,
      )}
      aria-label={siteCopy.documents.listHeading}
    >
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.04em] uppercase">
        {siteCopy.documents.listHeading}
      </p>
      <Button
        type="button"
        className="mb-3 w-full"
        onClick={onCreate}
        disabled={creating}
        aria-busy={creating || undefined}
      >
        <Plus className="size-4" aria-hidden />
        {siteCopy.documents.newDocument}
      </Button>
      <ul className="space-y-1 overflow-y-auto">
        {documents.map((doc) => {
          const updated = new Date(doc.updatedAt);
          const label = formatEditedLabel(updated, reference);
          const accessible = formatEditedAccessible(updated);
          const active = doc.id === activeId;
          return (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                aria-current={active ? "page" : undefined}
                aria-label={`${doc.title}, ${accessible}`}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <FileText
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    active ? "text-accent-foreground" : "text-muted-foreground",
                  )}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-medium">
                    {doc.title}
                  </span>
                  <time
                    dateTime={updated.toISOString()}
                    className="text-muted-foreground mt-0.5 block text-xs leading-snug"
                  >
                    {label}
                  </time>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
