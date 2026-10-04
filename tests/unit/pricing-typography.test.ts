import { describe, expect, it } from "vitest";
import {
  formatDeleteDocumentTitle,
  formatPricingCardPrice,
  splitPricingCardPrice,
  siteCopy,
} from "@/content/site";

describe("pricing / FAQ typography helpers", () => {
  it("splits price into amount and interval for mock-aligned sizing", () => {
    expect(formatPricingCardPrice("€8/month")).toBe("€8 /month");
    expect(splitPricingCardPrice("€8/month")).toEqual({
      amount: "€8",
      interval: " /month",
    });
    expect(splitPricingCardPrice("€9/month")).toEqual({
      amount: "€9",
      interval: " /month",
    });
    expect(splitPricingCardPrice("Free")).toEqual({
      amount: "Free",
      interval: "",
    });
  });

  it("formats delete document titles from siteCopy", () => {
    expect(formatDeleteDocumentTitle("Notes")).toBe(
      `${siteCopy.documents.deleteTitlePrefix} “Notes”?`,
    );
  });
});

