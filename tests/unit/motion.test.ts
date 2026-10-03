import { describe, expect, it } from "vitest";
import { cssDurationToMs, isReducedMotionStyle } from "@/lib/motion";

describe("motion duration helpers", () => {
  it("parses s and ms durations", () => {
    expect(cssDurationToMs("0.2s")).toBe(200);
    expect(cssDurationToMs("200ms")).toBe(200);
    expect(cssDurationToMs("0s")).toBe(0);
  });

  it("rejects NaN and unparseable durations", () => {
    expect(cssDurationToMs("NaN")).toBeNull();
    expect(cssDurationToMs("abc")).toBeNull();
    expect(cssDurationToMs("")).toBeNull();
    expect(cssDurationToMs("-1s")).toBeNull();
  });

  it("does not treat NaN transition durations as reduced motion", () => {
    expect(
      isReducedMotionStyle({
        animationName: "none",
        animationDuration: "0s",
        transitionProperty: "transform",
        transitionDuration: "NaNs",
      }),
    ).toBe(false);

    expect(
      isReducedMotionStyle({
        animationName: "sheet-in-right",
        animationDuration: "NaN",
        transitionProperty: "none",
        transitionDuration: "0s",
      }),
    ).toBe(false);
  });

  it("accepts true reduced-motion styles", () => {
    expect(
      isReducedMotionStyle({
        animationName: "none",
        animationDuration: "0.01ms",
        transitionProperty: "none",
        transitionDuration: "0.01ms",
      }),
    ).toBe(true);
  });
});
