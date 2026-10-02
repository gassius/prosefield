import Link from "next/link";
import { ProsefieldLogo } from "@/components/brand/prosefield-logo";
import { siteCopy } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-border mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ProsefieldLogo href="/" tone="field" />
          <p className="text-muted-foreground max-w-xs text-sm">
            {siteCopy.brand.promise}
          </p>
        </div>
        <nav
          className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
          aria-label="Footer"
        >
          <Link href="/#privacy" className="hover:text-foreground transition-colors">
            {siteCopy.footer.privacy}
          </Link>
          <Link href="/#terms" className="hover:text-foreground transition-colors">
            {siteCopy.footer.terms}
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            {siteCopy.header.signIn}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
