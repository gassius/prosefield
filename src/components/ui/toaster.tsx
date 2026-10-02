"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm border border-border bg-background text-foreground",
        },
      }}
    />
  );
}
