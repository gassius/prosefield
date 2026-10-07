"use client";

import { useCallback, useEffect, useEffectEvent, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { SpellcheckPopover } from "@/components/documents/spellcheck-popover";
import { SpellcheckTitleField } from "@/components/documents/spellcheck-title-field";
import { EditorToolbar } from "@/components/editor/toolbar";
import { SaveStatusIndicator } from "@/components/editor/save-status";
import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import { siteCopy } from "@/content/site";
import {
  createProsefieldSpellcheck,
  createProsefieldStarterKit,
} from "@/features/documents/editor-extensions";
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
import { useSpellcheckPopover } from "@/features/documents/spellcheck/use-spellcheck-popover";

type DocumentEditorProps = {
  documentId: string;
  initialTitle: string;
  initialContent: TiptapJson;
  initialIgnoredWords?: string[];
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
  initialIgnoredWords = [],
  contentAllowed,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [ignoredWords, setIgnoredWords] = useState(initialIgnoredWords);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(!contentAllowed);
  const [isMac] = useState(() =>
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  const [renaming, startRename] = useTransition();

  const onIgnoredWordsChange = useCallback((words: string[]) => {
    setIgnoredWords(words);
    setSaveStatus((current) => reduceSaveStatus(current, { type: "edit" }));
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      createProsefieldStarterKit(),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      createProsefieldSpellcheck({
        ignoredWords: initialIgnoredWords,
        onIgnoredWordsChange,
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
        spellcheck: "false",
      },
    },
    onUpdate: () => {
      if (blocked) {
        return;
      }
      setSaveStatus((current) => reduceSaveStatus(current, { type: "edit" }));
    },
  });

  const spellPopover = useSpellcheckPopover(blocked ? null : editor);

  useEffect(() => {
    editor?.storage.spellcheck.setIgnoredWords(ignoredWords);
  }, [editor, ignoredWords]);

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
    const result = await saveDocumentAction({
      documentId,
      content,
      ignoredWords,
    });
    if (!result.ok) {
      setSaveStatus((current) => reduceSaveStatus(current, { type: "failure" }));
      return;
    }
    setSaveStatus((current) => reduceSaveStatus(current, { type: "success" }));
  }, [blocked, documentId, editor, ignoredWords]);

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
          <p>{siteCopy.documents.contentBlocked}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={acknowledgeReset}
          >
            {siteCopy.documents.resetBlankPage}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <SpellcheckTitleField
          id={`doc-title-${documentId}`}
          label={siteCopy.documents.titleLabel}
          value={title}
          onChange={setTitle}
          onCommit={commitTitle}
          ignoredWords={ignoredWords}
          onIgnoredWordsChange={onIgnoredWordsChange}
          disabled={renaming}
          className="font-display text-foreground text-3xl font-medium tracking-tight focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
        <DeleteDocumentDialog documentId={documentId} title={title} />
      </div>
      {renameError ? (
        <p className="text-destructive mt-1 text-sm" role="alert">
          {renameError}
        </p>
      ) : null}

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

      <SpellcheckPopover
        open={spellPopover.open}
        word={spellPopover.misspelling?.word ?? ""}
        suggestions={spellPopover.misspelling?.suggestions ?? []}
        anchor={spellPopover.anchor}
        onClose={spellPopover.close}
        onSelectSuggestion={spellPopover.applySuggestion}
        onIgnore={spellPopover.ignore}
      />
    </div>
  );
}
