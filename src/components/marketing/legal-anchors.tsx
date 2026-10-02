import { siteCopy } from "@/content/site";

/** Lightweight Privacy / Terms anchors for footer links. */
export function LegalAnchors() {
  return (
    <section className="border-border border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2">
        <div id="privacy" className="scroll-mt-8">
          <h2 className="font-display text-foreground text-xl font-medium tracking-tight">
            {siteCopy.footer.privacyHeading}
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {siteCopy.footer.privacyBody}
          </p>
        </div>
        <div id="terms" className="scroll-mt-8">
          <h2 className="font-display text-foreground text-xl font-medium tracking-tight">
            {siteCopy.footer.termsHeading}
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {siteCopy.footer.termsBody}
          </p>
        </div>
      </div>
    </section>
  );
}
