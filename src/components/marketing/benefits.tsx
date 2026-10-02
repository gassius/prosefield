import { siteCopy } from "@/content/site";

/** Three-stage writing journey (Art Direction §9.4). */
export function Benefits() {
  return (
    <section id="benefits" className="scroll-mt-8 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-brand-deep inline-flex items-center gap-3 text-sm font-medium tracking-[0.02em]">
            <span className="bg-brand block h-px w-6 shrink-0" aria-hidden />
            {siteCopy.benefits.eyebrow}
          </p>
          <h2 className="font-display text-foreground mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
            {siteCopy.benefits.headline}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {siteCopy.benefits.supporting}
          </p>
        </div>

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-12">
          {siteCopy.benefits.stages.map((stage) => (
            <li key={stage.number} className="min-w-0">
              <div className="bg-brand mb-4 h-px w-10" aria-hidden />
              <p className="text-brand-deep text-sm font-medium tracking-[0.08em]">
                {stage.number}
              </p>
              <h3 className="font-display text-foreground mt-2 text-xl font-medium tracking-tight">
                {stage.title}
              </h3>
              <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
                {stage.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
