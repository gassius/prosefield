"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { findMisspellingAt } from "@/features/documents/spellcheck/find-misspelling-at";
import type { SpellcheckMisspelling } from "@/features/documents/spellcheck/spellcheck-extension";

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type SpellcheckPopoverState = {
  open: boolean;
  misspelling: SpellcheckMisspelling | null;
  anchor: AnchorRect | null;
};

function rectFromDom(el: Element): AnchorRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function misspellingFromTarget(
  target: EventTarget | null,
): { word: string; from: number; to: number; el: Element } | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const el = target.closest(".spellcheck-misspelled");
  if (!el) {
    return null;
  }
  const word = el.getAttribute("data-spellcheck-word");
  const from = Number(el.getAttribute("data-spellcheck-from"));
  const to = Number(el.getAttribute("data-spellcheck-to"));
  if (!word || !Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  return { word, from, to, el };
}

/**
 * Hover + keyboard (ContextMenu / Alt+F7) popover wiring for TipTap misspellings.
 */
export function useSpellcheckPopover(editor: Editor | null) {
  const [state, setState] = useState<SpellcheckPopoverState>({
    open: false,
    misspelling: null,
    anchor: null,
  });

  const close = useCallback(() => {
    setState({ open: false, misspelling: null, anchor: null });
  }, []);

  const openFor = useCallback(
    (misspelling: SpellcheckMisspelling, anchor: AnchorRect) => {
      setState({ open: true, misspelling, anchor });
    },
    [],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    const dom = editor.view.dom;

    function onMouseOver(event: MouseEvent) {
      const hit = misspellingFromTarget(event.target);
      if (!hit) {
        return;
      }
      const stored =
        editor!.storage.spellcheck.misspellings.find(
          (item) => item.from === hit.from && item.to === hit.to,
        ) ?? {
          from: hit.from,
          to: hit.to,
          word: hit.word,
          suggestions: [],
        };
      openFor(stored, rectFromDom(hit.el));
    }

    function openAtSelection() {
      const { from } = editor!.state.selection;
      const misspelling = findMisspellingAt(
        editor!.storage.spellcheck.misspellings,
        from,
      );
      if (!misspelling) {
        return;
      }
      const el = dom.querySelector(
        `.spellcheck-misspelled[data-spellcheck-from="${misspelling.from}"]`,
      );
      if (!el) {
        return;
      }
      openFor(misspelling, rectFromDom(el));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ContextMenu" || (event.altKey && event.key === "F7")) {
        event.preventDefault();
        openAtSelection();
      }
    }

    dom.addEventListener("mouseover", onMouseOver);
    dom.addEventListener("keydown", onKeyDown);
    return () => {
      dom.removeEventListener("mouseover", onMouseOver);
      dom.removeEventListener("keydown", onKeyDown);
    };
  }, [editor, openFor]);

  const applySuggestion = useCallback(
    (suggestion: string) => {
      if (!editor || !state.misspelling) {
        return;
      }
      editor
        .chain()
        .focus()
        .replaceMisspelling(
          state.misspelling.from,
          state.misspelling.to,
          suggestion,
        )
        .run();
      close();
    },
    [close, editor, state.misspelling],
  );

  const ignore = useCallback(() => {
    if (!editor || !state.misspelling) {
      return;
    }
    editor.chain().focus().ignoreSpelling(state.misspelling.word).run();
    close();
  }, [close, editor, state.misspelling]);

  return {
    ...state,
    close,
    applySuggestion,
    ignore,
  };
}
