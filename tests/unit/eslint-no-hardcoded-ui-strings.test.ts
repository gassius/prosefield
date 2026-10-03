import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

describe("prosefield/no-hardcoded-ui-strings", () => {
  const plantedDir = path.resolve(
    __dirname,
    "../../src/components/__eslint_planted__",
  );
  const planted = path.join(plantedDir, "planted.tsx");

  afterEach(() => {
    rmSync(plantedDir, { recursive: true, force: true });
  });

  it("fails on a planted hard-coded UI string", async () => {
    mkdirSync(plantedDir, { recursive: true });
    writeFileSync(
      planted,
      `export function Planted() {\n  return <p>Planted hard-coded UI string</p>;\n}\n`,
      "utf8",
    );

    const eslint = new ESLint({
      cwd: path.resolve(__dirname, "../.."),
      overrideConfigFile: path.resolve(__dirname, "../../eslint.config.mjs"),
    });
    const results = await eslint.lintFiles([planted]);
    const messages = results.flatMap((r) => r.messages);
    expect(
      messages.some((m) => m.ruleId === "prosefield/no-hardcoded-ui-strings"),
    ).toBe(true);
  });
});
