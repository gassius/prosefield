import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prosefield from "./eslint-rules/no-hardcoded-ui-strings.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node CJS fixture for Server Action encode/decode (needs require + react-server).
    "tests/unit/fixtures/**/*.cjs",
  ]),
  {
    files: ["src/components/**/*.{jsx,tsx}", "src/app/**/*.{jsx,tsx}"],
    plugins: {
      prosefield,
    },
    rules: {
      // UI copy must come from siteCopy (src/content/site.ts).
      "prosefield/no-hardcoded-ui-strings": [
        "error",
        {
          // Tiny punctuation / symbols used as layout fragments.
          allowedStrings: ["·", "/", "—", "…", "€", "$", "£"],
        },
      ],
    },
  },
  {
    // Server code must log through `@/lib/logger` (redacting). Client components
    // and the logger itself may use console.
    files: [
      "src/features/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/app/**/route.ts",
      "src/app/**/actions.ts",
      "src/instrumentation.ts",
      "src/proxy.ts",
    ],
    ignores: ["src/lib/logger.ts"],
    rules: {
      "no-console": "error",
    },
  },
]);

export default eslintConfig;
