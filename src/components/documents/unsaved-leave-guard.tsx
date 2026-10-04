"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PendingLeave = () => void;

type UnsavedLeaveGuardValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /**
   * If dirty, open the leave modal and run `action` only after Leave anyway.
   * If clean, run `action` immediately.
   */
  requestLeave: (action: PendingLeave) => void;
  leaveModalOpen: boolean;
  setLeaveModalOpen: (open: boolean) => void;
  confirmLeaveAnyway: () => void;
  cancelLeave: () => void;
};

const UnsavedLeaveGuardContext = createContext<UnsavedLeaveGuardValue | null>(
  null,
);

export function UnsavedLeaveGuardProvider({
  children,
  onDiscard,
}: {
  children: ReactNode;
  /** Called when the user confirms Leave anyway (clear stash / local draft). */
  onDiscard?: () => void;
}) {
  const [isDirty, setDirty] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [pending, setPending] = useState<PendingLeave | null>(null);

  const requestLeave = useCallback(
    (action: PendingLeave) => {
      if (!isDirty) {
        action();
        return;
      }
      setPending(() => action);
      setLeaveModalOpen(true);
    },
    [isDirty],
  );

  const confirmLeaveAnyway = useCallback(() => {
    onDiscard?.();
    setDirty(false);
    setLeaveModalOpen(false);
    const action = pending;
    setPending(null);
    action?.();
  }, [onDiscard, pending]);

  const cancelLeave = useCallback(() => {
    setPending(null);
    setLeaveModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isDirty,
      setDirty,
      requestLeave,
      leaveModalOpen,
      setLeaveModalOpen: (open: boolean) => {
        if (!open) {
          cancelLeave();
          return;
        }
        setLeaveModalOpen(true);
      },
      confirmLeaveAnyway,
      cancelLeave,
    }),
    [
      isDirty,
      requestLeave,
      leaveModalOpen,
      confirmLeaveAnyway,
      cancelLeave,
    ],
  );

  return (
    <UnsavedLeaveGuardContext.Provider value={value}>
      {children}
    </UnsavedLeaveGuardContext.Provider>
  );
}

export function useUnsavedLeaveGuard(): UnsavedLeaveGuardValue | null {
  return useContext(UnsavedLeaveGuardContext);
}
