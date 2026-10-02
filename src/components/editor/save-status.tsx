"use client";

import {
  type SaveStatus,
} from "@/features/documents/save-state";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";
import { AlertCircle, LoaderCircle } from "lucide-react";

type SaveStatusProps = {
  status: SaveStatus;
  className?: string;
};

export function SaveStatusIndicator({ status, className }: SaveStatusProps) {
  const label =
    status === "saved"
      ? siteCopy.documents.saved
      : status === "unsaved"
        ? siteCopy.documents.unsaved
        : status === "saving"
          ? siteCopy.documents.saving
          : siteCopy.documents.saveFailed;

  const isAlert = status === "failed";

  return (
    <div
      className={cn("flex items-center gap-2 text-sm", className)}
      aria-live={isAlert ? undefined : "polite"}
      role={isAlert ? "alert" : "status"}
      data-save-status={status}
    >
      {status === "saved" ? (
        <span
          className="bg-success size-2.5 shrink-0 rounded-full"
          aria-hidden
        />
      ) : null}
      {status === "unsaved" ? (
        <span
          className="bg-warning size-2.5 shrink-0 rounded-full"
          aria-hidden
        />
      ) : null}
      {status === "saving" ? (
        <LoaderCircle
          className="text-muted-foreground size-4 shrink-0 animate-spin"
          aria-hidden
        />
      ) : null}
      {status === "failed" ? (
        <AlertCircle className="text-destructive size-4 shrink-0" aria-hidden />
      ) : null}
      <span
        className={cn(
          status === "failed" && "text-destructive",
          status === "saved" && "text-success",
          status === "unsaved" && "text-warning",
          status === "saving" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}
