import path from "node:path";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  alias: {
    "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    "next/headers": path.resolve(__dirname, "tests/mocks/next-headers.ts"),
    "@": path.resolve(__dirname, "src"),
  },
};

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
        // Overall floor (unit + component + integration).
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        // Pure modules: csrf etc. cannot hide under the average.
        "src/features/auth/{account-state,auth-time,constants,csrf,map-auth-error,next}.ts":
          {
            lines: 90,
            functions: 90,
            branches: 80,
            statements: 90,
          },
        "src/lib/env.ts": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        "src/lib/utils.ts": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        // Emulator-backed surface: integration must keep these above the floor.
        "src/features/auth/{session,guards,users}.ts": {
          lines: 30,
          functions: 40,
          branches: 50,
          statements: 30,
        },
        "src/lib/firebase/**": {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
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
