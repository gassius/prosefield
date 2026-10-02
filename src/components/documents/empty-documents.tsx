"use client";

import { CultivatedMark } from "@/components/brand/prosefield-logo";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";

type EmptyDocumentsProps = {
  onCreate: () => void;
  creating?: boolean;
};

export function EmptyDocuments({
  onCreate,
  creating = false,
}: EmptyDocumentsProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <CultivatedMark size={40} className="text-brand" labelled />
      <h1 className="font-display mt-6 text-3xl font-medium tracking-tight">
        {siteCopy.documents.emptyTitle}
      </h1>
      <p className="text-muted-foreground mt-3 text-base leading-relaxed">
        {siteCopy.documents.emptyBody}
      </p>
      <Button
        type="button"
        className="mt-8"
        onClick={onCreate}
        disabled={creating}
        aria-busy={creating || undefined}
      >
        {siteCopy.documents.newDocument}
      </Button>
    </div>
  );
}
