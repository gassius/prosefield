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
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
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
