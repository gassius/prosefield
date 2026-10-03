/**
 * All product copy (en-GB). Marketing strings live here so components never
 * hard-code them. FEATURE_CUSTOMER_PORTAL gates Art Direction 4.5 claims.
 */

export const siteCopy = {
  brand: {
    name: "Prosefield",
    promise: "Make space for better writing.",
  },
  header: {
    signIn: "Sign in",
    signOut: "Sign out",
    cta: "Start your first page",
    menu: "Open menu",
    menuTitle: "Menu",
    closeMenu: "Close menu",
    navBenefits: "Benefits",
    navPricing: "Pricing",
    navFaq: "FAQ",
    manageBilling: "Manage billing",
    primaryNav: "Primary",
    mobileNav: "Mobile",
    signedInFallback: "Signed in",
  },
  auth: {
    registerTitle: "Create your account",
    registerLead: "Start with a quiet workspace of your own.",
    loginTitle: "Welcome back",
    loginLead: "Sign in to return to your documents.",
    emailLabel: "Email",
    passwordLabel: "Password",
    registerSubmit: "Create account",
    loginSubmit: "Sign in",
    haveAccount: "Already have an account?",
    needAccount: "Need an account?",
    genericError: "Email or password is incorrect.",
    networkError: "Something went wrong. Please try again.",
    signOutError: "We couldn't sign you out. Please try again.",
    passwordHint: "Use at least 8 characters.",
  },
  a11y: {
    skipToContent: "Skip to content",
  },
  home: {
    eyebrow: "A focused home for your writing",
    headline: "Turn scattered thoughts into something worth reading.",
    supporting:
      "Prosefield gives your ideas a quiet, capable workspace—from the rough first line to the draft you are ready to share.",
    explore: "Explore the editor",
    cancelAnytime: "Cancel anytime",
  },
  assurance: {
    regionLabel: "Assurances",
    items: [
      {
        id: "private",
        label: "Private by default",
        icon: "shield",
      },
      {
        id: "saved",
        label: "Securely saved",
        icon: "lock",
      },
      {
        id: "plan",
        label: "One simple plan",
        icon: "plan",
      },
    ],
  },
  benefits: {
    eyebrow: "From thought to finished draft",
    headline: "A writing flow with less friction.",
    supporting:
      "Every part of Prosefield is designed to keep you moving instead of managing the tool.",
    stages: [
      {
        number: "01",
        title: "Find your focus",
        body: "One clear workspace keeps the page—not the interface—at the centre.",
      },
      {
        number: "02",
        title: "Shape the idea",
        body: "Use familiar headings, lists and quotes to give structure and rhythm to your thinking.",
      },
      {
        number: "03",
        title: "Return with confidence",
        body: "Your documents are organised, private and waiting where you left them.",
      },
    ],
  },
  pricing: {
    eyebrow: "Simple by design",
    headline: "One plan. Zero clutter.",
    supporting:
      "No feature maze and no surprise upgrades. Everything you need for focused writing is included.",
    badge: "Full workspace",
    benefits: [
      "Your own private document library",
      "Headings, lists, quotes and emphasis",
      "Save with one click or Ctrl+S",
      "Rename and delete documents at any time",
    ],
  },
  faq: {
    eyebrow: "Questions",
    headline: "Before you start.",
    items: [
      {
        id: "private",
        question: "Are my documents private?",
        answer:
          "Yes. Document access is checked on the server. The browser cannot read your Firestore data directly.",
      },
      {
        id: "subscribe",
        question: "What happens after I subscribe?",
        answer:
          "Stripe confirms payment with a signed webhook. Only then does Prosefield unlock your document workspace.",
      },
      {
        id: "mobile",
        question: "Does Prosefield work on mobile?",
        answer:
          "Yes. The landing page, document list and editor are built to work on phones, tablets and desktops.",
      },
    ],
    cancelItem: {
      id: "cancel",
      question: "Can I cancel at any time?",
      answer:
        "Yes. When billing management is enabled, you can cancel from Manage billing via the Stripe Customer Portal.",
    },
  },
  finalCta: {
    headline: "Make space for your next good idea.",
    supporting: "Open a calmer workspace and start with the first line.",
  },
  preview: {
    ariaLabel: "Preview of the Prosefield editor",
    documentsHeading: "Documents",
    newDocument: "New document",
    saved: "Saved",
    save: "Save",
    toolbarHeading: "H2",
    sampleTitle: "Clarity changes the work.",
    sampleBody:
      "When the workspace is calm, the next sentence becomes easier to see. Keep the structure simple, the tools close, and the idea moving.",
    sampleHeading2: "What we are deciding",
    sampleBody2:
      "A short brief that the whole team can read in two minutes, with the open questions at the end.",
    documents: [
      {
        title: "Project brief",
        edited: "Edited 2 minutes ago",
        dateTime: "2026-10-02T10:58:00Z",
      },
      {
        title: "Research notes",
        edited: "Edited yesterday",
        dateTime: "2026-10-01T14:00:00Z",
      },
      {
        title: "Weekly review",
        edited: "Edited 28 September",
        dateTime: "2026-09-28T09:00:00Z",
      },
    ],
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    navLabel: "Footer",
    privacyHeading: "Privacy",
    privacyBody:
      "Prosefield stores your account and documents in Firebase. Access is enforced on the server; there is no browser Firestore access.",
    termsHeading: "Terms",
    termsBody:
      "Prosefield is a take-home demonstration product. Subscriptions use Stripe test mode only.",
  },
  subscribe: {
    title: "Subscribe to start writing",
    body: "One simple plan for a calm, private writing workspace.",
    checkoutCta: "Continue to secure checkout",
    checkoutBusy: "Starting checkout…",
    checkoutError: "Could not start checkout. Please try again.",
  },
  documents: {
    upgradeTitle: "Subscribe to start writing",
    upgradeBody:
      "Your own private document library with headings, lists, quotes, and emphasis.",
    upgradeCta: "Continue to secure checkout",
    listHeading: "Documents",
    newDocument: "New document",
    emptyTitle: "Your first page is waiting.",
    emptyBody: "Create a document to start writing.",
    deleteTitlePrefix: "Delete",
    deleteBody: "This can't be undone.",
    deleteCancel: "Cancel",
    deleteConfirm: "Delete document",
    deletedToast: "Document deleted.",
    save: "Save",
    saved: "Saved",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    saveFailed: "Save failed. Try again.",
    titleLabel: "Document title",
    backToList: "All documents",
    editorLandmark: "Document editor",
  },
  billingStatus: {
    title: "Confirming payment",
    pending: "Confirming your payment with Stripe…",
    delayed:
      "We’re still waiting for Stripe to confirm your payment. Refresh this page or try again shortly.",
    failedTitle: "Payment didn't go through",
    failedBody: "No charge unlocked access. You can try checkout again.",
    tryAgain: "Try again",
  },
} as const;

export type SiteCopy = typeof siteCopy;

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

/**
 * Art Direction 4.5 / Architecture §5.4: Cancel-anytime claims require both
 * FEATURE_CUSTOMER_PORTAL=true and a shipped Customer Portal route.
 * Flip `isCustomerPortalRouteReady` when POST /api/billing/portal exists.
 */
export function isCustomerPortalRouteReady(): boolean {
  return false;
}

export type PortalGateOptions = {
  /** Test override. Production uses `isCustomerPortalRouteReady()`. */
  portalRouteReady?: boolean;
};

export function isCustomerPortalEnabled(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options?: PortalGateOptions,
): boolean {
  const routeReady =
    options?.portalRouteReady ?? isCustomerPortalRouteReady();
  return routeReady && source.FEATURE_CUSTOMER_PORTAL === "true";
}

/** Appends “Cancel anytime” only when portal claims are allowed. */
export function checkoutReassuranceLine(
  base: string,
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options?: PortalGateOptions,
): string {
  if (!isCustomerPortalEnabled(source, options)) {
    return base;
  }
  return `${base} · ${siteCopy.home.cancelAnytime}`;
}

/** FAQ list including the cancel question only when portal claims are allowed. */
export function getFaqItems(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options?: PortalGateOptions,
): FaqItem[] {
  const items: FaqItem[] = [...siteCopy.faq.items];
  if (isCustomerPortalEnabled(source, options)) {
    items.push(siteCopy.faq.cancelItem);
  }
  return items;
}

/** Pricing card display: keep the plan label, add a space before the slash. */
export function formatPricingCardPrice(priceLabel: string): string {
  return priceLabel.replace("/", " /");
}

