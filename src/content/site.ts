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
    navBenefits: "Benefits",
    navPricing: "Pricing",
    navFaq: "FAQ",
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
    passwordHint: "Use at least 6 characters.",
  },
  home: {
    eyebrow: "A focused home for your writing",
    headline: "Turn scattered thoughts into something worth reading.",
    supporting:
      "Prosefield gives your ideas a quiet, capable workspace—from the rough first line to the draft you are ready to share.",
    explore: "Explore the editor",
  },
  subscribe: {
    title: "Subscribe to start writing",
    body: "Billing arrives in the next phase. Your account is ready.",
  },
  documents: {
    upgradeTitle: "Subscribe to start writing",
    upgradeBody: "An active subscription unlocks your document workspace.",
  },
} as const;

export type SiteCopy = typeof siteCopy;
