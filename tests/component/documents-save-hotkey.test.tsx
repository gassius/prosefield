import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import {
  isDirtySaveStatus,
  isSaveHotkey,
  reduceSaveStatus,
  type SaveStatus,
} from "@/features/documents/save-state";

/**
 * Supplemental save-state harness. Prefer DocumentEditor tests in
 * documents-editor.test.tsx for beforeunload / hotkey / save transitions —
 * those are the ones that must bite on the real editor.
 */
function SaveHarness() {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedViaHotkey, setSavedViaHotkey] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSaveHotkey(event)) {
        return;
      }
      event.preventDefault();
      setStatus((current) => reduceSaveStatus(current, { type: "save" }));
      setSavedViaHotkey(true);
      setStatus((current) => reduceSaveStatus(current, { type: "success" }));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirtySaveStatus(status)) {
        event.preventDefault();
        event.returnValue = "unsaved";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setStatus((current) => reduceSaveStatus(current, { type: "edit" }))
        }
      >
        Edit
      </button>
      <span data-testid="status">{status}</span>
      <span data-testid="hotkey">{savedViaHotkey ? "yes" : "no"}</span>
    </div>
  );
}

describe("save hotkey and beforeunload wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Ctrl/Cmd+S triggers save transition", async () => {
    const user = userEvent.setup();
    render(<SaveHarness />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("status")).toHaveTextContent("unsaved");

    await user.keyboard("{Control>}s{/Control}");
    expect(screen.getByTestId("hotkey")).toHaveTextContent("yes");
    expect(screen.getByTestId("status")).toHaveTextContent("saved");
  });

  it("beforeunload fires when dirty", async () => {
    const user = userEvent.setup();
    render(<SaveHarness />);
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", {
      writable: true,
      value: "",
    });
    const prevented = !window.dispatchEvent(event);
    // preventDefault sets defaultPrevented; jsdom may not set returnValue the same way.
    expect(event.defaultPrevented || prevented || event.returnValue === "unsaved").toBe(
      true,
    );
  });
});
