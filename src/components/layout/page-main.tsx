import { cn } from "@/lib/utils";

type PageMainProps = {
  children: React.ReactNode;
  className?: string;
};

/** Landmark main (skip-link target). Header/footer must render outside this. */
export function PageMain({ children, className }: PageMainProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn("flex flex-1 flex-col outline-none", className)}
    >
      {children}
    </main>
  );
}
