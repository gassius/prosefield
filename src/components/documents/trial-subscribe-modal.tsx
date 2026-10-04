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
import { siteCopy } from "@/content/site";

type TrialSubscribeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeCheckout: () => void | Promise<void>;
};

/**
 * Invitation to subscribe from locked trial actions (Save / New / Delete / hotkey).
 */
export function TrialSubscribeModal({
  open,
  onOpenChange,
  onBeforeCheckout,
}: TrialSubscribeModalProps) {
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
        data-testid="trial-subscribe-modal"
      >
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>
            {siteCopy.documents.trialSubscribeModalTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {siteCopy.documents.trialSubscribeModalBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef}>
            {siteCopy.documents.deleteCancel}
          </AlertDialogCancel>
          <CheckoutButton
            label={siteCopy.documents.trialSubscribeCta}
            cancelPath="/documents/trial"
            onBeforeCheckout={onBeforeCheckout}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
