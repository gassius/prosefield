"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatDeleteDocumentTitle, siteCopy } from "@/content/site";
import { deleteDocumentAction } from "@/features/documents/actions";

type DeleteDocumentDialogProps = {
  documentId: string;
  title: string;
};

export function DeleteDocumentDialog({
  documentId,
  title,
}: DeleteDocumentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      // Art Direction 12.6: Cancel focused by default.
      const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDocumentAction({ documentId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      toast.success(siteCopy.documents.deletedToast);
      router.push("/documents");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          {siteCopy.documents.deleteConfirm}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent aria-labelledby={titleId}>
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>
            {formatDeleteDocumentTitle(title)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {siteCopy.documents.deleteBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} disabled={pending}>
            {siteCopy.documents.deleteCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
          >
            {siteCopy.documents.deleteConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
