import Link from "next/link";
import { PageMain } from "@/components/layout/page-main";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <PageMain className="justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-24 text-center">
        <h1 className="font-display text-foreground text-3xl font-medium tracking-tight">
          {siteCopy.notFound.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {siteCopy.notFound.body}
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "default" }),
            "mt-8 inline-flex self-center",
          )}
        >
          {siteCopy.notFound.homeCta}
        </Link>
      </div>
    </PageMain>
  );
}
