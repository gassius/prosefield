"use client";

import { useEffect, useId, useRef } from "react";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

export type SpellcheckPopoverProps = {
  open: boolean;
  word: string;
  suggestions: string[];
  anchor: { top: number; left: number; width: number; height: number } | null;
  onSelectSuggestion: (suggestion: string) => void;
  onIgnore: () => void;
  onClose: () => void;
};

export function SpellcheckPopover({
  open,
  word,
  suggestions,
  anchor,
  onSelectSuggestion,
  onIgnore,
  onClose,
}: SpellcheckPopoverProps) {
  const labelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  if (!open || !anchor) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelId}
      data-testid="spellcheck-popover"
      className={cn(
        "border-border bg-background text-foreground fixed z-50 min-w-[12rem] rounded-md border p-1 shadow-md",
      )}
      style={{
        top: anchor.top + anchor.height + 4,
        left: anchor.left,
      }}
    >
      <p id={labelId} className="sr-only">
        {siteCopy.documents.spellcheckPopoverLabelFor} {word}
      </p>
      {suggestions.length === 0 ? (
        <p className="text-muted-foreground px-2 py-1.5 text-sm">
          {siteCopy.documents.spellcheckNoSuggestions}
        </p>
      ) : (
        <ul className="flex flex-col">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="hover:bg-muted w-full rounded-sm px-2 py-1.5 text-left text-sm"
                onClick={() => onSelectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="hover:bg-muted mt-0.5 w-full rounded-sm px-2 py-1.5 text-left text-sm"
        onClick={onIgnore}
        data-testid="spellcheck-ignore"
      >
        {siteCopy.documents.spellcheckIgnore}
      </button>
    </div>
  );
}
