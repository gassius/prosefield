import { useEffect } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UnsavedLeaveGuardProvider,
  useUnsavedLeaveGuard,
} from "@/components/documents/unsaved-leave-guard";

function GuardControls({
  dirty,
  action,
}: {
  dirty: boolean;
  action: () => void;
}) {
  const guard = useUnsavedLeaveGuard();
  useEffect(() => {
    guard?.setDirty(dirty);
  }, [dirty, guard]);
  return (
    <div>
      <button type="button" onClick={() => guard?.requestLeave(action)}>
        request-leave
      </button>
      <button type="button" onClick={() => guard?.confirmLeaveAnyway()}>
        confirm-leave
      </button>
      <button type="button" onClick={() => guard?.cancelLeave()}>
        cancel-leave
      </button>
      <span data-testid="dirty">{String(guard?.isDirty)}</span>
      <span data-testid="modal">{String(guard?.leaveModalOpen)}</span>
    </div>
  );
}

describe("UnsavedLeaveGuardProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("runs the leave action immediately when clean (no modal)", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <UnsavedLeaveGuardProvider>
        <GuardControls dirty={false} action={action} />
      </UnsavedLeaveGuardProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("dirty")).toHaveTextContent("false");
    });
    await user.click(screen.getByRole("button", { name: "request-leave" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("modal")).toHaveTextContent("false");
  });

  it("opens the modal when dirty and only runs the action after Leave anyway", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const onDiscard = vi.fn();
    render(
      <UnsavedLeaveGuardProvider onDiscard={onDiscard}>
        <GuardControls dirty action={action} />
      </UnsavedLeaveGuardProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    });
    await user.click(screen.getByRole("button", { name: "request-leave" }));
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toHaveTextContent("true");
    });
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "cancel-leave" }));
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toHaveTextContent("false");
    });
    expect(action).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "request-leave" }));
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toHaveTextContent("true");
    });
    await user.click(screen.getByRole("button", { name: "confirm-leave" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("setLeaveModalOpen(true) opens the modal without a pending action", async () => {
    const user = userEvent.setup();
    function OpenOnly() {
      const guard = useUnsavedLeaveGuard();
      return (
        <div>
          <button
            type="button"
            onClick={() => guard?.setLeaveModalOpen(true)}
          >
            open-modal
          </button>
          <span data-testid="modal-open">{String(guard?.leaveModalOpen)}</span>
        </div>
      );
    }
    render(
      <UnsavedLeaveGuardProvider>
        <OpenOnly />
      </UnsavedLeaveGuardProvider>,
    );
    await user.click(screen.getByRole("button", { name: "open-modal" }));
    expect(screen.getByTestId("modal-open")).toHaveTextContent("true");
  });

  it("setLeaveModalOpen(false) cancels a pending leave", async () => {
    const user = userEvent.setup();
    function CancelViaProp() {
      const guard = useUnsavedLeaveGuard();
      useEffect(() => {
        guard?.setDirty(true);
      }, [guard]);
      return (
        <button
          type="button"
          onClick={() => {
            guard?.requestLeave(() => undefined);
            guard?.setLeaveModalOpen(false);
          }}
        >
          request-and-cancel
        </button>
      );
    }
    function ModalFlag() {
      const guard = useUnsavedLeaveGuard();
      return (
        <span data-testid="modal-flag">{String(guard?.leaveModalOpen)}</span>
      );
    }
    render(
      <UnsavedLeaveGuardProvider>
        <CancelViaProp />
        <ModalFlag />
      </UnsavedLeaveGuardProvider>,
    );
    await user.click(screen.getByRole("button", { name: "request-and-cancel" }));
    expect(screen.getByTestId("modal-flag")).toHaveTextContent("false");
  });
});
