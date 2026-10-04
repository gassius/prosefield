"use client";

import { useEffect, useId, useRef } from "react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";

type TrialLeaveModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeCheckout: () => void | Promise<void>;
  /** Disarm beforeunload only immediately before Stripe redirect. */
  onBeforeRedirect: () => void;
  onLeaveAnyway: () => void;
};

/**
 * Subscribe-or-leave guard when the trial draft is dirty.
 */
export function TrialLeaveModal({
  open,
  onOpenChange,
  onBeforeCheckout,
  onBeforeRedirect,
  onLeaveAnyway,
}: TrialLeaveModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        aria-labelledby={titleId}
        data-testid="trial-leave-modal"
      >
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>
            {siteCopy.documents.trialLeaveModalTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {siteCopy.documents.trialLeaveModalBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef}>
            {siteCopy.documents.deleteCancel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="secondary"
            onClick={onLeaveAnyway}
            data-testid="trial-leave-anyway"
          >
            {siteCopy.documents.trialLeaveAnyway}
          </Button>
          <CheckoutButton
            label={siteCopy.documents.trialSubscribeCta}
            cancelPath="/documents/trial"
            onBeforeCheckout={onBeforeCheckout}
            onBeforeRedirect={onBeforeRedirect}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
