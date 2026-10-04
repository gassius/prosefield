import { describe, expect, it } from "vitest";
import { resolveCheckoutCancelPath } from "@/features/billing/checkout-cancel-path";

describe("resolveCheckoutCancelPath", () => {
  it("accepts allow-listed paths", () => {
    expect(resolveCheckoutCancelPath("/subscribe")).toBe("/subscribe");
    expect(resolveCheckoutCancelPath("/documents/trial")).toBe(
      "/documents/trial",
    );
  });

  it("rejects open redirects and unknown paths", () => {
    expect(resolveCheckoutCancelPath("https://evil.example")).toBe("/subscribe");
    expect(resolveCheckoutCancelPath("//evil")).toBe("/subscribe");
    expect(resolveCheckoutCancelPath("/subscribe?x=1")).toBe("/subscribe");
    expect(resolveCheckoutCancelPath("/documents")).toBe("/subscribe");
    expect(resolveCheckoutCancelPath(null)).toBe("/subscribe");
  });
});
