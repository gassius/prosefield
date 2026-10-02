/**
 * Manual-save state machine (Art Direction 12.3).
 * Pure transitions — UI maps each state to copy and aria attributes.
 */

export type SaveStatus = "saved" | "unsaved" | "saving" | "failed";

export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  failed: "Save failed. Try again.",
};

export type SaveEvent =
  | { type: "edit" }
  | { type: "save" }
  | { type: "success" }
  | { type: "failure" }
  | { type: "reset" };

export function reduceSaveStatus(
  status: SaveStatus,
  event: SaveEvent,
): SaveStatus {
  switch (event.type) {
    case "edit":
      if (status === "saving") {
        return status;
      }
      return "unsaved";
    case "save":
      if (status === "unsaved" || status === "failed" || status === "saved") {
        return "saving";
      }
      return status;
    case "success":
      return status === "saving" ? "saved" : status;
    case "failure":
      return status === "saving" ? "failed" : status;
    case "reset":
      return "saved";
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function isDirtySaveStatus(status: SaveStatus): boolean {
  return status === "unsaved" || status === "failed";
}

export function saveButtonBusy(status: SaveStatus): boolean {
  return status === "saving";
}

export function saveButtonPrimary(status: SaveStatus): boolean {
  return status === "unsaved" || status === "failed";
}

/** Platform-aware Save tooltip (Art Direction 12.3). */
export function saveShortcutTooltip(isMac: boolean): string {
  return isMac ? "Save (⌘S)" : "Save (Ctrl+S)";
}

export function isSaveHotkey(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">,
): boolean {
  return (
    event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)
  );
}
