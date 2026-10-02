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
      ],
      // Client Firebase bootstrap is browser-only; covered indirectly by E2E.
      exclude: ["src/lib/firebase/client.ts"],
      thresholds: {
        // Ratcheted to measured Component+coverage values minus a small margin.
        // Billing added to include; thresholds must not go down (ticket + AGENTS.md).
        lines: 95,
        functions: 95,
        branches: 88,
        statements: 95,
        "src/features/auth/{account-state,auth-time,constants,csrf,map-auth-error,next}.ts":
          highBar,
        "src/lib/env.ts": highBar,
        "src/lib/utils.ts": highBar,
        "src/features/auth/{session,guards,users}.ts": authSurfaceBar,
        "src/features/billing/{entitlement,plan-display,configured}.ts": highBar,
        "src/features/billing/{projection,webhook,checkout,customers,session-sync,plan,actions}.ts":
          authSurfaceBar,
        "src/features/documents/{schemas,format-time,save-state,ownership}.ts":
          highBar,
        "src/features/documents/repository.ts": {
          lines: 95,
          functions: 95,
          branches: 75,
          statements: 95,
        },
        "src/features/documents/actions.ts": {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        "src/lib/firebase/**": {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        "src/lib/stripe/**": {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
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
