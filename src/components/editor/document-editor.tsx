"use client";

import { useCallback, useEffect, useEffectEvent, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "@/components/editor/toolbar";
import { SaveStatusIndicator } from "@/components/editor/save-status";
import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import { siteCopy } from "@/content/site";
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
import type { TiptapJson } from "@/features/documents/schemas";
import { cn } from "@/lib/utils";

type DocumentEditorProps = {
  documentId: string;
  initialTitle: string;
  initialContent: TiptapJson;
};

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isMac] = useState(() =>
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  const [renaming, startRename] = useTransition();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        // Keep paragraph, bulletList, orderedList, blockquote, bold, italic, history.
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prosefield-editor min-h-[50vh] focus:outline-none text-base leading-relaxed",
        "aria-label": siteCopy.documents.editorLandmark,
      },
    },
    onUpdate: () => {
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
    if (!editor) {
      return;
    }
    setSaveStatus((current) => reduceSaveStatus(current, { type: "save" }));
    const content = editor.getJSON() as TiptapJson;
    const result = await saveDocumentAction({ documentId, content });
    if (!result.ok) {
      setSaveStatus((current) => reduceSaveStatus(current, { type: "failure" }));
      return;
    }
    setSaveStatus((current) => reduceSaveStatus(current, { type: "success" }));
  }, [documentId, editor]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
        editor={editor}
        saveStatus={saveStatus}
        onSave={() => void performSave()}
        isMac={isMac}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <SaveStatusIndicator status={saveStatus} />
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
