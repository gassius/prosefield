import path from "node:path";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  alias: {
    "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    "next/headers": path.resolve(__dirname, "tests/mocks/next-headers.ts"),
    "@": path.resolve(__dirname, "src"),
  },
};

const highBar = {
  lines: 95,
  functions: 95,
  branches: 85,
  statements: 95,
} as const;

const authSurfaceBar = {
  lines: 92,
  functions: 90,
  branches: 75,
  statements: 92,
} as const;

export default defineConfig({
  resolve: sharedResolve,
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/features/auth/**/*.{ts,tsx}",
        "src/features/billing/**/*.{ts,tsx}",
        "src/features/documents/**/*.{ts,tsx}",
        "src/content/**/*.{ts,tsx}",
        "src/components/layout/**/*.{ts,tsx}",
        "src/components/marketing/**/*.{ts,tsx}",
        "src/components/auth/sign-out-button.tsx",
        "src/components/auth/account-menu.tsx",
        "src/components/auth/use-sign-out.ts",
        "src/components/ui/accordion.tsx",
        "src/components/ui/sheet.tsx",
        "src/components/ui/dropdown-menu.tsx",
        "src/instrumentation.ts",
        "src/proxy.ts",
      ],
      // Client Firebase bootstrap is browser-only; covered indirectly by E2E.
      // types.ts is type-only (no runtime statements beyond the server-only import).
      exclude: [
        "src/lib/firebase/client.ts",
        "src/lib/crypto/types.ts",
      ],
      thresholds: {
        // Ratcheted to measured Component+coverage on main (PR #21 / 92149a7):
        // ~99.65% lines/statements, ~98.26% branches, 100% functions.
        // Only go up; never lower.
        lines: 99.6,
        functions: 100,
        branches: 98.2,
        statements: 99.6,
        "src/features/auth/{account-state,auth-time,constants,csrf,map-auth-error,next}.ts":
          highBar,
        "src/lib/env.ts": highBar,
        "src/lib/env-defaults.ts": highBar,
        "src/lib/motion.ts": highBar,
        "src/lib/startup-env.ts": highBar,
        "src/lib/utils.ts": highBar,
        "src/lib/security-headers.ts": highBar,
        "src/lib/crypto/**": {
          lines: 95,
          functions: 95,
          branches: 85,
          statements: 95,
        },
        "src/features/auth/password.ts": highBar,
        "src/features/auth/register.ts": highBar,
        "src/features/auth/register-input.ts": highBar,
        "src/instrumentation.ts": highBar,
        "src/features/auth/{session,guards,users}.ts": authSurfaceBar,
        "src/features/billing/{entitlement,plan-display,configured}.ts": highBar,
        "src/features/billing/{projection,webhook,checkout,customers,session-sync,subscriptions,plan,actions}.ts":
          authSurfaceBar,
        "src/features/documents/{schemas,format-time,save-state,ownership,editor-extensions}.ts":
          {
            lines: 99,
            functions: 99,
            branches: 95,
            statements: 99,
          },
        "src/features/documents/repository.ts": {
          lines: 99,
          functions: 99,
          branches: 97,
          statements: 99,
        },
        "src/features/documents/actions.ts": {
          lines: 99,
          functions: 99,
          branches: 99,
          statements: 99,
        },
        "src/lib/firebase/**": {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        "src/lib/stripe/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["tests/setup/component.ts"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
        },
      },
    ],
  },
});
