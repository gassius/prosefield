import { describe, expect, it } from "vitest";
import { siteCopy } from "@/content/site";

describe("billing failed-panel copy", () => {
  it("uses the suggested failed-body wording", () => {
    expect(siteCopy.billingStatus.failedBody).toBe(
      "Your payment wasn't completed. You can try checkout again.",
    );
    expect(siteCopy.billingStatus.failedBody).not.toMatch(/No charge unlocked/i);
  });
});
