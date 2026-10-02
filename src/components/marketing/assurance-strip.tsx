import { BadgeEuro, DollarSign, Lock, PoundSterling, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { siteCopy } from "@/content/site";

const icons = {
  shield: Shield,
  lock: Lock,
} as const;

/** Plan currency icon (Architecture §5.2): Euro/BadgeEuro for EUR, never DollarSign for EUR. */
export function planCurrencyIcon(currency: string): LucideIcon {
  switch (currency.toUpperCase()) {
    case "EUR":
      return BadgeEuro;
    case "GBP":
      return PoundSterling;
    case "USD":
      return DollarSign;
    default:
      return BadgeEuro;
  }
}

type AssuranceStripProps = {
  currency: string;
};

/** Three verifiable trust statements (Art Direction §9.3). */
export function AssuranceStrip({ currency }: AssuranceStripProps) {
  const PlanIcon = planCurrencyIcon(currency);

  return (
    <section
      aria-label={siteCopy.assurance.regionLabel}
      className="border-border border-y bg-background"
    >
      <ul className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-3 sm:gap-8 sm:py-12">
        {siteCopy.assurance.items.map((item) => {
          const Icon = item.icon === "plan" ? PlanIcon : icons[item.icon];
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 sm:justify-center"
            >
              <span className="bg-accent text-brand-deep inline-flex size-10 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-foreground text-sm font-medium tracking-[0.01em]">
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
