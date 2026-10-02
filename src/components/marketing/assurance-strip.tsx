import { BadgeEuro, Lock, Shield } from "lucide-react";
import { siteCopy } from "@/content/site";

const icons = {
  shield: Shield,
  lock: Lock,
  euro: BadgeEuro,
} as const;

/** Three verifiable trust statements (Art Direction §9.3). */
export function AssuranceStrip() {
  return (
    <section
      aria-label="Assurances"
      className="border-border border-y bg-background"
    >
      <ul className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-3 sm:gap-8 sm:py-12">
        {siteCopy.assurance.items.map((item) => {
          const Icon = icons[item.icon];
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
