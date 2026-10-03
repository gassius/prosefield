"use client";

import { useCallback, useEffect, useEffectEvent, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "@/components/editor/toolbar";
import { SaveStatusIndicator } from "@/components/editor/save-status";
import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import { siteCopy } from "@/content/site";
import { createProsefieldStarterKit } from "@/features/documents/editor-extensions";
import {
  renameDocumentAction,
  saveDocumentAction,
} from "@/features/documents/actions";
import {
  isDirtySaveStatus,
  isSaveHotkey,
  reduceSaveStatus,
  type SaveStatus,
} from "@/features/documents/save-state";
import {
  EMPTY_DOCUMENT_CONTENT,
  plainTiptapJson,
  type TiptapJson,
} from "@/features/documents/schemas";
import { cn } from "@/lib/utils";

type DocumentEditorProps = {
  documentId: string;
  initialTitle: string;
  initialContent: TiptapJson;
  /**
   * Required — no fail-open default. When false, stored JSON failed the
   * allow-list; save is blocked so an emptied editor cannot overwrite storage.
   */
  contentAllowed: boolean;
};

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  contentAllowed,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(!contentAllowed);
  const [isMac] = useState(() =>
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  const [renaming, startRename] = useTransition();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      createProsefieldStarterKit(),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    // Never feed off-spec JSON into Tiptap — it would empty the doc and enable overwrite.
    content: contentAllowed ? initialContent : EMPTY_DOCUMENT_CONTENT,
    editable: contentAllowed,
    editorProps: {
      attributes: {
        class:
          "prosefield-editor min-h-[50vh] focus:outline-none text-base leading-relaxed",
        "aria-label": siteCopy.documents.editorLandmark,
      },
    },
    onUpdate: () => {
      if (blocked) {
        return;
      }
      setSaveStatus((current) => reduceSaveStatus(current, { type: "edit" }));
    },
  });

  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
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

  const performSave = useCallback(async () => {
    if (!editor || blocked) {
      return;
    }
    setSaveStatus((current) => reduceSaveStatus(current, { type: "save" }));
    // TipTap attrs are null-prototype; plain-clone before Server Actions.
    const content = plainTiptapJson(editor.getJSON());
    const result = await saveDocumentAction({ documentId, content });
    if (!result.ok) {
      setSaveStatus((current) => reduceSaveStatus(current, { type: "failure" }));
      return;
    }
    setSaveStatus((current) => reduceSaveStatus(current, { type: "success" }));
  }, [blocked, documentId, editor]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSaveHotkey(event)) {
        return;
      }
      event.preventDefault();
      void performSave();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performSave]);

  function commitTitle(nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed) {
      setTitle(savedTitle);
      return;
    }
    if (trimmed === savedTitle) {
      setTitle(savedTitle);
      return;
    }
    setRenameError(null);
    startRename(async () => {
      const result = await renameDocumentAction({
        documentId,
        title: trimmed,
      });
      if (!result.ok) {
        setRenameError(result.message);
        setTitle(savedTitle);
        return;
      }
      setTitle(result.data.title);
      setSavedTitle(result.data.title);
    });
  }

  function acknowledgeReset() {
    setBlocked(false);
    editor?.commands.setContent(EMPTY_DOCUMENT_CONTENT);
    editor?.setEditable(true);
    setSaveStatus("unsaved");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {blocked ? (
        <div
          className="bg-destructive-soft text-destructive mb-4 rounded-md px-3 py-2 text-sm"
          role="alert"
          data-testid="content-blocked"
        >
          <p>
            This document contains unsupported formatting and cannot be saved
            until it is reset. Your stored copy is unchanged.
          </p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={acknowledgeReset}
          >
            Reset to a blank page
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`doc-title-${documentId}`}>
            {siteCopy.documents.titleLabel}
          </label>
          <input
            id={`doc-title-${documentId}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => commitTitle(title)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            disabled={renaming}
            maxLength={120}
            className={cn(
              "font-display text-foreground w-full bg-transparent text-3xl font-medium tracking-tight",
              "focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            )}
          />
          {renameError ? (
            <p className="text-destructive mt-1 text-sm" role="alert">
              {renameError}
            </p>
          ) : null}
        </div>
        <DeleteDocumentDialog documentId={documentId} title={title} />
      </div>

      <EditorToolbar
        editor={blocked ? null : editor}
        saveStatus={blocked ? "saved" : saveStatus}
        onSave={() => void performSave()}
        isMac={isMac}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <SaveStatusIndicator status={blocked ? "saved" : saveStatus} />
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
