import { describe, expect, it } from "vitest";
import {
  formatEditedAccessible,
  formatEditedLabel,
} from "@/features/documents/format-time";

describe("formatEditedLabel (Art Direction 12.1)", () => {
  const now = new Date("2026-10-02T12:00:00");

  it("uses relative labels for recent edits", () => {
    expect(
      formatEditedLabel(new Date("2026-10-02T11:59:30"), now),
    ).toBe("Edited just now");
    expect(
      formatEditedLabel(new Date("2026-10-02T11:58:00"), now),
    ).toBe("Edited 2 minutes ago");
    expect(
      formatEditedLabel(new Date("2026-10-02T11:00:00"), now),
    ).toBe("Edited 1 hour ago");
    expect(
      formatEditedLabel(new Date("2026-10-02T09:00:00"), now),
    ).toBe("Edited 3 hours ago");
  });

  it("uses yesterday, day+month, and year when needed", () => {
    expect(
      formatEditedLabel(new Date("2026-10-01T15:00:00"), now),
    ).toBe("Edited yesterday");
    expect(
      formatEditedLabel(new Date("2026-09-28T09:00:00"), now),
    ).toBe("Edited 28 September");
    expect(
      formatEditedLabel(new Date("2025-09-28T09:00:00"), now),
    ).toBe("Edited 28 September 2025");
  });

  it("builds an accessible absolute label", () => {
    const label = formatEditedAccessible(new Date("2026-10-01T11:42:00"));
    expect(label).toMatch(/edited 1 October 2026 at 11:42/i);
  });
});
