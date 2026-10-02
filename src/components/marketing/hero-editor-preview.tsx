import {
  Bold,
  FileText,
  Italic,
  List,
  Plus,
  Quote,
  Save,
  Undo2,
} from "lucide-react";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

type HeroEditorPreviewProps = {
  className?: string;
};

/** Static decorative editor preview (Art Direction §11). Reuses PR #6 card. */
export function HeroEditorPreview({ className }: HeroEditorPreviewProps) {
  return (
    <div
      className={cn("relative w-full", className)}
      role="img"
      aria-label={siteCopy.preview.ariaLabel}
      inert
    >
      {/* Growth backdrop: offset up/left so the card overlaps right/bottom */}
      <div
        className="bg-accent absolute inset-0 -translate-x-3 -translate-y-4 rounded-2xl sm:-translate-x-4 sm:-translate-y-5"
        aria-hidden
      />

      <div
        className="border-border bg-card text-card-foreground relative overflow-hidden rounded-xl border shadow-[0_12px_40px_-12px_rgba(27,29,33,0.18)]"
        aria-hidden
      >
        <div className="flex min-h-[300px] sm:min-h-[340px]">
          <aside className="border-border bg-secondary/60 hidden w-[42%] shrink-0 flex-col border-r p-4 sm:flex">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.04em] uppercase">
              {siteCopy.preview.documentsHeading}
            </p>
            <div className="bg-primary text-primary-foreground mb-3 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {siteCopy.preview.newDocument}
            </div>
            <ul className="space-y-1">
              {siteCopy.preview.documents.map((doc, index) => {
                const active = index === 0;
                return (
                  <li
                    key={doc.title}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2.5 py-2",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    <FileText
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        active
                          ? "text-accent-foreground"
                          : "text-muted-foreground",
                      )}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm leading-snug",
                          active
                            ? "font-medium"
                            : "font-medium text-foreground",
                        )}
                      >
                        {doc.title}
                      </span>
                      <time
                        dateTime={doc.dateTime}
                        className="text-muted-foreground mt-0.5 block text-xs leading-snug"
                      >
                        {doc.edited}
                      </time>
                    </span>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex flex-nowrap items-center gap-0.5 overflow-hidden border-b px-2.5 py-2 sm:gap-1 sm:px-3">
              <Undo2
                className="text-muted-foreground size-3.5 shrink-0"
                strokeWidth={1.75}
              />
              <span className="text-muted-foreground shrink-0 px-0.5 text-xs font-semibold tracking-tight">
                H2
              </span>
              <span className="bg-accent text-accent-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-md">
                <Bold className="size-3.5" strokeWidth={2.25} />
              </span>
              <Italic
                className="text-muted-foreground size-3.5 shrink-0"
                strokeWidth={1.75}
              />
              <List
                className="text-muted-foreground size-3.5 shrink-0"
                strokeWidth={1.75}
              />
              <Quote
                className="text-muted-foreground size-3.5 shrink-0"
                strokeWidth={1.75}
              />
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <span className="bg-success size-1.5 rounded-full" aria-hidden />
                  <span className="text-muted-foreground text-xs">
                    {siteCopy.preview.saved}
                  </span>
                </span>
                <span className="border-input text-foreground inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
                  <Save className="size-3" strokeWidth={1.75} aria-hidden />
                  {siteCopy.preview.save}
                </span>
              </span>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
              <p className="font-display text-foreground text-2xl leading-snug font-medium tracking-tight">
                {siteCopy.preview.sampleTitle}
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-base">
                {siteCopy.preview.sampleBody}
              </p>
              <p className="font-display text-foreground text-xl leading-snug font-medium tracking-tight">
                {siteCopy.preview.sampleHeading2}
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-base">
                {siteCopy.preview.sampleBody2}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
