import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";
import { cn } from "@/lib/utils";

export default async function SubscribePage() {
  await requireSessionOrRedirect("/login?next=/subscribe");
  const account = await getAccountState();
  if (account.kind === "subscriber") {
    redirect("/documents");
  }

  const ctaHref = ctaDestinationForState(account);

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {siteCopy.subscribe.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {siteCopy.subscribe.body}
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-8 w-fit")}
        >
          Back to home
        </Link>
      </div>
    </>
  );
}
