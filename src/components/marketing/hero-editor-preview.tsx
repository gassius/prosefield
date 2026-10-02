import {
  Bold,
  Heading2,
  ImageIcon,
  Italic,
  List,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HeroEditorPreviewProps = {
  className?: string;
};

const documents = [
  { title: "Project brief", active: true },
  { title: "Research notes", active: false },
  { title: "Weekly review", active: false },
] as const;

/** Static decorative editor preview (Art Direction §11). */
export function HeroEditorPreview({ className }: HeroEditorPreviewProps) {
  return (
    <div
      className={cn(
        "bg-accent/80 relative w-full rounded-2xl p-4 sm:p-6 md:p-8",
        className,
      )}
      aria-hidden="true"
      inert
    >
      <div className="border-border bg-card text-card-foreground shadow-sm overflow-hidden rounded-xl border">
        <div className="flex min-h-[280px] sm:min-h-[320px]">
          <aside className="border-border bg-muted/40 hidden w-[38%] shrink-0 flex-col border-r p-3 sm:flex">
            <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
              Documents
            </p>
            <div className="bg-primary text-primary-foreground mb-3 rounded-md px-2.5 py-1.5 text-center text-[11px] font-medium">
              New document
            </div>
            <ul className="space-y-1 text-[11px]">
              {documents.map((doc) => (
                <li
                  key={doc.title}
                  className={cn(
                    "rounded-md px-2 py-1.5",
                    doc.active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {doc.title}
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex items-center gap-1.5 border-b px-3 py-2">
              <Undo2 className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <Heading2 className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <Bold className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <Italic className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <List className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <ImageIcon className="text-muted-foreground size-3.5" strokeWidth={1.75} />
              <span className="ml-auto flex items-center gap-1.5">
                <span className="bg-success size-1.5 rounded-full" aria-hidden />
                <span className="text-muted-foreground text-[10px]">Saved</span>
                <span className="border-border text-foreground rounded-md border px-2 py-0.5 text-[10px] font-medium">
                  Save
                </span>
              </span>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
              <p className="font-display text-foreground text-lg leading-snug font-medium sm:text-xl">
                Clarity changes the work.
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed sm:text-xs">
                When the page stays calm, the argument can breathe. Structure
                appears where there was only noise.
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed sm:text-xs">
                A short paragraph keeps the rhythm honest—enough room to think,
                not enough to wander.
              </p>
              <p className="font-display text-foreground pt-1 text-sm font-medium">
                What we are deciding
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
