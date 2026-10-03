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
]);

export default eslintConfig;
