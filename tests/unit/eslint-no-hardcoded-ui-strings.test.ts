import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const repoRoot = path.resolve(__dirname, "../..");
const configPath = path.resolve(repoRoot, "eslint.config.mjs");
/** Virtual path under the rule's files glob — never written to disk. */
const virtualComponentPath = path.join(
  repoRoot,
  "src/components/__virtual__/planted.tsx",
);

async function lintSource(code: string) {
  const eslint = new ESLint({
    cwd: repoRoot,
    overrideConfigFile: configPath,
  });
  const results = await eslint.lintText(code, {
    filePath: virtualComponentPath,
  });
  return results.flatMap((r) => r.messages);
}

function hasRule(messages: { ruleId?: string | null }[]) {
  return messages.some(
    (m) => m.ruleId === "prosefield/no-hardcoded-ui-strings",
  );
}

describe("prosefield/no-hardcoded-ui-strings", () => {
  it("fails on a planted hard-coded JSX text string (lintText, no src/ write)", async () => {
    const messages = await lintSource(
      `export function Planted() {\n  return <p>Planted hard-coded UI string</p>;\n}\n`,
    );
    expect(hasRule(messages)).toBe(true);
  });

  it("fails on hard-coded aria-label / title / placeholder / alt attributes", async () => {
    for (const attr of ["aria-label", "title", "placeholder", "alt"] as const) {
      const messages = await lintSource(
        `export function Planted() {\n  return <div ${attr}="Planted attr string" />;\n}\n`,
      );
      expect(hasRule(messages), `expected rule to flag ${attr}`).toBe(true);
    }
  });

  it("allows siteCopy expressions in those attributes", async () => {
    const messages = await lintSource(
      `import { siteCopy } from "@/content/site";\nexport function Ok() {\n  return <div aria-label={siteCopy.documents.toolbarAriaLabel} />;\n}\n`,
    );
    expect(
      messages.filter((m) => m.ruleId === "prosefield/no-hardcoded-ui-strings"),
    ).toHaveLength(0);
  });
});
