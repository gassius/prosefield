import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteCopy } from "@/content/site";

type LogoTone = "field" | "ink" | "paper";

type ProsefieldLogoProps = {
  className?: string;
  href?: string | null;
  /** Mark edge length in px. Under 24 uses the simplified two-line mark. */
  markSize?: number;
  tone?: LogoTone;
  showWordmark?: boolean;
};

const toneClass: Record<LogoTone, string> = {
  field: "text-brand",
  ink: "text-foreground",
  paper: "text-primary-foreground",
};

/** Path counts for the full vs simplified cultivated-P marks (Art Direction 5.4). */
export function cultivatedMarkPathCount(size: number): number {
  return size < 24 ? 3 : 6;
}

export function CultivatedMark({
  size,
  className,
  labelled = false,
}: {
  size: number;
  className?: string;
  /** When true, expose the mark alone to AT (mark-only surfaces). */
  labelled?: boolean;
}) {
  const simplified = cultivatedMarkPathCount(size) === 3;
  const strokeWidth = simplified ? 2.4 : 1.75;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? siteCopy.brand.name : undefined}
      aria-hidden={labelled ? undefined : true}
      className={className}
    >
      <path d="M6 21.2V2.8h7.2a5.9 5.9 0 0 1 0 11.8H6" />
      {simplified ? (
        <>
          <path d="M9.6 7h4.2" />
          <path d="M9.6 10h4.2" />
        </>
      ) : (
        <>
          <path d="M9.4 6.4h4.6" />
          <path d="M9.4 9h4.6" />
          <path d="M9.4 11.6h3" />
          <path d="M10 16.6c2.6-1.1 5.6-1.1 8.6.3" />
          <path d="M10 20c2.6-1.1 5.6-1.1 8.6.3" />
        </>
      )}
    </svg>
  );
}

/**
 * Official cultivated-P lockup (Art Direction 5.2–5.4).
 * Header/footer lockups stay at markSize 24 (full mark). The simplified
 * two-line mark applies under 24 px — used by `public/brand/prosefield-mark-simplified.svg`,
 * `prosefield-favicon.svg`, `src/app/icon.svg`, and any caller with markSize < 24.
 */
export function ProsefieldLogo({
  className,
  href = "/",
  markSize = 24,
  tone = "field",
  showWordmark = true,
}: ProsefieldLogoProps) {
  const markOnly = !showWordmark;
  const mark = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CultivatedMark
        size={markSize}
        className={toneClass[tone]}
        labelled={markOnly && !href}
      />
      {showWordmark ? (
        <span className="font-display text-[18px] leading-none font-medium tracking-tight text-foreground">
          {siteCopy.brand.name}
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label={`${siteCopy.brand.name} home`}
      className="rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {mark}
    </Link>
  );
}
