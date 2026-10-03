import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { ProsefieldLogo } from "@/components/brand/prosefield-logo";
import { PageMain } from "@/components/layout/page-main";
import { siteCopy } from "@/content/site";
import { getAccountState, ctaDestinationForState } from "@/features/auth/guards";
import { resolveNextPath } from "@/features/auth/next";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const account = await getAccountState();
  if (account.kind !== "logged_out") {
    redirect(ctaDestinationForState(account));
  }

  const nextPath = resolveNextPath(params.next, "/subscribe");

  return (
    <PageMain className="justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-16">
        <div className="mb-10">
          <ProsefieldLogo />
        </div>
        <AuthForm mode="login" nextPath={nextPath} />
        <p className="text-muted-foreground mt-8 text-center text-sm">
          {siteCopy.auth.needAccount}{" "}
          <Link
            href={`/register?next=${encodeURIComponent(nextPath)}`}
            className="text-brand-deep font-medium underline-offset-4 hover:underline"
          >
            {siteCopy.auth.registerSubmit}
          </Link>
        </p>
      </div>
    </PageMain>
  );
}
