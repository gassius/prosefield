import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteCopy } from "@/content/site";

type ProsefieldLogoProps = {
  className?: string;
  href?: string;
};

/** Provisional cultivated-P lockup (Art Direction 5.3). */
export function ProsefieldLogo({
  className,
  href = "/",
}: ProsefieldLogoProps) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-brand-deep"
      >
        <path
          fill="currentColor"
          d="M6 3.5h6.2c3.35 0 5.55 1.85 5.55 4.7 0 2.35-1.35 3.95-3.55 4.55L18.6 20h-3.2l-4.05-6.55H8.6V20H6V3.5Zm2.6 2.35v5.25h3.35c1.95 0 3.1-.95 3.1-2.6s-1.15-2.65-3.15-2.65H8.6Z"
        />
      </svg>
      <span className="font-display text-[18px] leading-none font-medium tracking-tight text-foreground">
        {siteCopy.brand.name}
      </span>
    </span>
  );

  if (!href) {
    return mark;
  }

  return (
    <Link href={href} className="rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
      {mark}
      <span className="sr-only">{siteCopy.brand.name} home</span>
    </Link>
  );
}
