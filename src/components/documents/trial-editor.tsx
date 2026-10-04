"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { AlertCircle, FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { EditorToolbar } from "@/components/editor/toolbar";
import { SaveStatusIndicator } from "@/components/editor/save-status";
import { Button } from "@/components/ui/button";
import { TrialLeaveModal } from "@/components/documents/trial-leave-modal";
import { TrialSubscribeModal } from "@/components/documents/trial-subscribe-modal";
import { useUnsavedLeaveGuard } from "@/components/documents/unsaved-leave-guard";
import { siteCopy } from "@/content/site";
import { createProsefieldStarterKit } from "@/features/documents/editor-extensions";
import {
  isDirtySaveStatus,
  isSaveHotkey,
  reduceSaveStatus,
  type SaveStatus,
} from "@/features/documents/save-state";
import {
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_CONTENT,
  plainTiptapJson,
} from "@/features/documents/schemas";
import {
  readTrialDraft,
  stashTrialDraft,
  type TrialDraft,
} from "@/features/documents/trial-draft-stash";
import { cn } from "@/lib/utils";

const TRIAL_DOC_ID = "trial-local";

type TrialEditorProps = {
  uid: string;
  initialDraft?: TrialDraft | null;
};

export function TrialEditor({ uid, initialDraft }: TrialEditorProps) {
  const router = useRouter();
  const leaveGuard = useUnsavedLeaveGuard();
  /** Disarms beforeunload after stash-for-checkout or Leave anyway (no second prompt). */
  const allowUnloadRef = useRef(false);
  const starting = useMemo(() => {
    if (initialDraft) {
      return initialDraft;
    }
    return readTrialDraft(uid) ?? {
      title: DEFAULT_DOCUMENT_TITLE,
      content: EMPTY_DOCUMENT_CONTENT,
    };
  }, [initialDraft, uid]);

  const [title, setTitle] = useState(starting.title);
  /** Last committed title — blur no-ops when onChange already updated `title`. */
  const committedTitleRef = useRef(starting.title);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    starting.title !== DEFAULT_DOCUMENT_TITLE ||
      JSON.stringify(starting.content) !== JSON.stringify(EMPTY_DOCUMENT_CONTENT)
      ? "unsaved"
      : "saved",
  );
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isMac] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      createProsefieldStarterKit(),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    content: starting.content,
    editable: true,
    editorProps: {
      attributes: {
        class:
          "prosefield-editor min-h-[50vh] focus:outline-none text-base leading-relaxed",
        "aria-label": siteCopy.documents.editorLandmark,
      },
    },
    onUpdate: () => {
      allowUnloadRef.current = false;
      setSaveStatus((current) => reduceSaveStatus(current, { type: "edit" }));
    },
  });

  const dirty = isDirtySaveStatus(saveStatus);

  useEffect(() => {
    leaveGuard?.setDirty(dirty);
  }, [dirty, leaveGuard]);

  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (allowUnloadRef.current) {
      return;
    }
    if (isDirtySaveStatus(saveStatus)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => onBeforeUnload(event);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  const currentDraft = useCallback((): TrialDraft => {
    const content = editor
      ? plainTiptapJson(editor.getJSON())
      : EMPTY_DOCUMENT_CONTENT;
    return {
      title: title.trim() || DEFAULT_DOCUMENT_TITLE,
      content,
    };
  }, [editor, title]);

  /**
   * Validate + stash before Stripe redirect. On success, disarm the leave
   * guard so `location.assign` never triggers a native "Leave site?" dialog.
   */
  const stashCurrent = useCallback(async () => {
    const result = stashTrialDraft(uid, currentDraft());
    if (!result.ok) {
      setDraftError(
        result.reason === "invalid"
          ? siteCopy.documents.trialDraftInvalid
          : siteCopy.subscribe.checkoutError,
      );
      throw new Error(`trial_stash_${result.reason}`);
    }
    setDraftError(null);
    allowUnloadRef.current = true;
    leaveGuard?.setDirty(false);
  }, [currentDraft, leaveGuard, uid]);

  const openSubscribeModal = useCallback(() => {
    setSubscribeOpen(true);
  }, []);

  const onLeaveAnyway = useCallback(() => {
    // Avoid a second native beforeunload prompt after Leave anyway navigates.
    allowUnloadRef.current = true;
    leaveGuard?.confirmLeaveAnyway();
  }, [leaveGuard]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSaveHotkey(event)) {
        return;
      }
      event.preventDefault();
      openSubscribeModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSubscribeModal]);

  // Intercept in-app link navigation while dirty.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!leaveGuard?.isDirty) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) {
        return;
      }
      // Allow same-page trial hash-less self links.
      if (href === "/documents/trial") {
        return;
      }
      // External absolute URLs — still guard (would lose draft).
      event.preventDefault();
      event.stopPropagation();
      leaveGuard.requestLeave(() => {
        router.push(href);
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [leaveGuard, router]);

  function commitTitle(nextTitle: string) {
    const trimmed = nextTitle.trim() || DEFAULT_DOCUMENT_TITLE;
    setTitle(trimmed);
    if (trimmed === committedTitleRef.current) {
      return;
    }
    committedTitleRef.current = trimmed;
    allowUnloadRef.current = false;
    setSaveStatus((current) => reduceSaveStatus(current, { type: "edit" }));
  }

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 md:block lg:w-80">
          <aside
            className="border-border flex h-full w-full flex-col border-r bg-secondary/40 p-4"
            aria-label={siteCopy.documents.listHeading}
          >
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.04em] uppercase">
              {siteCopy.documents.listHeading}
            </p>
            <Button
              type="button"
              className="mb-3 w-full"
              onClick={openSubscribeModal}
              data-testid="trial-new-document"
            >
              <Plus className="size-4" aria-hidden />
              {siteCopy.documents.newDocument}
            </Button>
            <ul className="space-y-1">
              <li>
                <div
                  aria-current="page"
                  className="bg-accent text-accent-foreground flex items-start gap-2 rounded-md px-2.5 py-2 text-left"
                >
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {title.trim() || DEFAULT_DOCUMENT_TITLE}
                  </span>
                </div>
              </li>
            </ul>
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-8">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`doc-title-${TRIAL_DOC_ID}`}>
                  {siteCopy.documents.titleLabel}
                </label>
                <input
                  id={`doc-title-${TRIAL_DOC_ID}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => commitTitle(title)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  maxLength={120}
                  className={cn(
                    "font-display text-foreground w-full bg-transparent text-3xl font-medium tracking-tight",
                    "focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  )}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="md:hidden"
                  onClick={openSubscribeModal}
                  data-testid="trial-new-document-mobile"
                >
                  <Plus className="size-4" aria-hidden />
                  {siteCopy.documents.newDocument}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openSubscribeModal}
                  data-testid="trial-delete-document"
                >
                  {siteCopy.documents.deleteConfirm}
                </Button>
              </div>
            </div>

            <EditorToolbar
              editor={editor}
              // Keep Save looking enabled (not greyed) while functionally locked.
              saveStatus="unsaved"
              onSave={openSubscribeModal}
              isMac={isMac}
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              {dirty ? (
                <SaveStatusIndicator status="unsaved" />
              ) : (
                <div
                  className="text-muted-foreground flex items-center gap-2 text-sm"
                  role="status"
                  data-save-status="trial-not-saved"
                >
                  <span
                    className="bg-muted-foreground/40 size-2.5 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <span>{siteCopy.documents.trialNotSaved}</span>
                </div>
              )}
            </div>

            {draftError ? (
              <p
                role="alert"
                className="bg-destructive-soft text-destructive mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
                data-testid="trial-draft-error"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{draftError}</span>
              </p>
            ) : null}

            <div className="mt-4 min-h-0 flex-1">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      <TrialSubscribeModal
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        onBeforeCheckout={stashCurrent}
      />
      <TrialLeaveModal
        open={leaveGuard?.leaveModalOpen ?? false}
        onOpenChange={(open) => leaveGuard?.setLeaveModalOpen(open)}
        onBeforeCheckout={stashCurrent}
        onLeaveAnyway={onLeaveAnyway}
      />
    </>
  );
}
