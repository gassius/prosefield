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
import { cn } from "@/lib/utils";

type HeroEditorPreviewProps = {
  className?: string;
};

const documents = [
  {
    title: "Project brief",
    edited: "Edited 2 minutes ago",
    dateTime: "2026-10-02T10:58:00Z",
    active: true,
  },
  {
    title: "Research notes",
    edited: "Edited yesterday",
    dateTime: "2026-10-01T14:00:00Z",
    active: false,
  },
  {
    title: "Weekly review",
    edited: "Edited 28 September",
    dateTime: "2026-09-28T09:00:00Z",
    active: false,
  },
] as const;

/** Static decorative editor preview (Art Direction §11). */
export function HeroEditorPreview({ className }: HeroEditorPreviewProps) {
  return (
    <div
      className={cn("relative w-full", className)}
      aria-hidden="true"
      inert
    >
      {/* Growth backdrop: offset up/left so the card overlaps right/bottom */}
      <div
        className="bg-accent absolute inset-0 -translate-x-3 -translate-y-4 rounded-2xl sm:-translate-x-4 sm:-translate-y-5"
        aria-hidden
      />

      <div className="border-border bg-card text-card-foreground relative overflow-hidden rounded-xl border shadow-[0_12px_40px_-12px_rgba(27,29,33,0.18)]">
        <div className="flex min-h-[300px] sm:min-h-[340px]">
          <aside className="border-border bg-secondary/60 hidden w-[42%] shrink-0 flex-col border-r p-4 sm:flex">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.04em] uppercase">
              Documents
            </p>
            <div className="bg-primary text-primary-foreground mb-3 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              New document
            </div>
            <ul className="space-y-1">
              {documents.map((doc) => (
                <li
                  key={doc.title}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2.5 py-2",
                    doc.active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground",
                  )}
                >
                  <FileText
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      doc.active ? "text-accent-foreground" : "text-muted-foreground",
                    )}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm leading-snug",
                        doc.active ? "font-medium" : "font-medium text-foreground",
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
              ))}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex flex-wrap items-center gap-1 border-b px-3 py-2.5 sm:gap-1.5">
              <Undo2 className="text-muted-foreground size-4" strokeWidth={1.75} />
              <span className="text-muted-foreground px-0.5 text-xs font-semibold tracking-tight">
                H2
              </span>
              <span className="bg-accent text-accent-foreground inline-flex size-7 items-center justify-center rounded-md">
                <Bold className="size-4" strokeWidth={2.25} />
              </span>
              <Italic className="text-muted-foreground size-4" strokeWidth={1.75} />
              <List className="text-muted-foreground size-4" strokeWidth={1.75} />
              <Quote className="text-muted-foreground size-4" strokeWidth={1.75} />
              <span className="ml-auto flex items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="bg-success size-2 rounded-full" aria-hidden />
                  <span className="text-muted-foreground text-xs">Saved</span>
                </span>
                <span className="border-input text-foreground inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium">
                  <Save className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Save
                </span>
              </span>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
              <p className="font-display text-foreground text-2xl leading-snug font-medium tracking-tight">
                Clarity changes the work.
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-base">
                When the workspace is calm, the next sentence becomes easier to
                see. Keep the structure simple, the tools close, and the idea
                moving.
              </p>
              <p className="font-display text-foreground text-xl leading-snug font-medium tracking-tight">
                What we are deciding
              </p>
              <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-base">
                A short brief that the whole team can read in two minutes, with
                the open questions at the end.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
