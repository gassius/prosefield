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
  lines: 90,
  functions: 90,
  branches: 80,
  statements: 90,
} as const;

const authSurfaceBar = {
  lines: 80,
  functions: 70,
  branches: 65,
  statements: 80,
} as const;

export default defineConfig({
  resolve: sharedResolve,
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.{ts,tsx}", "src/features/auth/**/*.{ts,tsx}"],
      // Client Firebase bootstrap is browser-only; covered indirectly by E2E.
      exclude: ["src/lib/firebase/client.ts"],
      thresholds: {
        // Ticket: ≥80% lines on src/lib and auth code.
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
        "src/features/auth/{account-state,auth-time,constants,csrf,map-auth-error,next}.ts":
          highBar,
        "src/lib/env.ts": highBar,
        "src/lib/utils.ts": highBar,
        "src/features/auth/{session,guards,users}.ts": authSurfaceBar,
        "src/lib/firebase/**": {
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
