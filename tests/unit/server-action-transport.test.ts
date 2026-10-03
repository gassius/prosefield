import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Finding 7: null-prototype TipTap attrs become Server Action temporary
 * references ($T) under real encodeReply/decodeReply. plainTiptapJson fixes it.
 */
describe("Server Action encode/decode transport (null-prototype attrs)", () => {
  it("plainTiptapJson survives encodeReply/decodeReply; raw null-proto attrs do not", () => {
    const script = path.resolve(
      __dirname,
      "fixtures/rsc-attrs-roundtrip.cjs",
    );
    const out = execFileSync(
      process.execPath,
      ["--conditions", "react-server", script],
      {
        cwd: path.resolve(__dirname, "../.."),
        encoding: "utf8",
      },
    );
    const result = JSON.parse(out) as {
      rawAttrsType: string;
      rawSchemaOk: boolean;
      plainAttrsType: string;
      plainLevel: number | null;
      plainSchemaOk: boolean;
    };

    expect(result.rawAttrsType).toBe("function");
    expect(result.rawSchemaOk).toBe(false);
    expect(result.plainAttrsType).toBe("object");
    expect(result.plainLevel).toBe(2);
    expect(result.plainSchemaOk).toBe(true);
  });
});
