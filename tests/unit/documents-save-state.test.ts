import { describe, expect, it } from "vitest";
import {
  isDirtySaveStatus,
  isSaveHotkey,
  reduceSaveStatus,
  saveButtonBusy,
  saveButtonPrimary,
  saveShortcutTooltip,
  type SaveStatus,
} from "@/features/documents/save-state";

describe("save-state machine", () => {
  it("transitions through the four Art Direction 12.3 states", () => {
    let status: SaveStatus = "saved";
    status = reduceSaveStatus(status, { type: "edit" });
    expect(status).toBe("unsaved");
    expect(isDirtySaveStatus(status)).toBe(true);
    expect(saveButtonPrimary(status)).toBe(true);

    status = reduceSaveStatus(status, { type: "save" });
    expect(status).toBe("saving");
    expect(saveButtonBusy(status)).toBe(true);

    status = reduceSaveStatus(status, { type: "success" });
    expect(status).toBe("saved");
    expect(isDirtySaveStatus(status)).toBe(false);

    status = reduceSaveStatus(status, { type: "edit" });
    status = reduceSaveStatus(status, { type: "save" });
    status = reduceSaveStatus(status, { type: "failure" });
    expect(status).toBe("failed");
    expect(isDirtySaveStatus(status)).toBe(true);
    expect(saveButtonPrimary(status)).toBe(true);
  });

  it("ignores edit while saving and supports retry from failed", () => {
    let status: SaveStatus = "saving";
    expect(reduceSaveStatus(status, { type: "edit" })).toBe("saving");
    status = "failed";
    expect(reduceSaveStatus(status, { type: "save" })).toBe("saving");
  });

  it("detects Ctrl/Cmd+S and builds platform tooltips", () => {
    expect(
      isSaveHotkey({ key: "s", metaKey: true, ctrlKey: false }),
    ).toBe(true);
    expect(
      isSaveHotkey({ key: "S", metaKey: false, ctrlKey: true }),
    ).toBe(true);
    expect(
      isSaveHotkey({ key: "s", metaKey: false, ctrlKey: false }),
    ).toBe(false);
    expect(saveShortcutTooltip(true)).toBe("Save (⌘S)");
    expect(saveShortcutTooltip(false)).toBe("Save (Ctrl+S)");
  });
});
