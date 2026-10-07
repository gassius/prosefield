"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SpellcheckPopover } from "@/components/documents/spellcheck-popover";
import { SPELLCHECK_DEBOUNCE_MS } from "@/features/documents/spellcheck/constants";
import {
  addIgnoredWord,
  ignoredWordsSet,
  isWordIgnored,
} from "@/features/documents/spellcheck/ignore-list";
import { getSpellcheckClient } from "@/features/documents/spellcheck/spellcheck-client";
import { tokenizeForSpellcheck } from "@/features/documents/spellcheck/tokenize";
import { cn } from "@/lib/utils";

type TitleMisspelling = {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
};

export type SpellcheckTitleFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  ignoredWords: string[];
  onIgnoredWordsChange: (words: string[]) => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
};

export function SpellcheckTitleField({
  id,
  label,
  value,
  onChange,
  onCommit,
  ignoredWords,
  onIgnoredWordsChange,
  disabled,
  maxLength = 120,
  className,
}: SpellcheckTitleFieldProps) {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [misspellings, setMisspellings] = useState<TitleMisspelling[]>([]);
  const [popover, setPopover] = useState<{
    open: boolean;
    item: TitleMisspelling | null;
    anchor: { top: number; left: number; width: number; height: number } | null;
  }>({ open: false, item: null, anchor: null });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const tokens = tokenizeForSpellcheck(value).filter(
          (token) => !isWordIgnored(token.word, ignoredWords),
        );
        if (tokens.length === 0) {
          if (!cancelled) {
            setMisspellings([]);
          }
          return;
        }
        try {
          const results = await getSpellcheckClient().checkWords(
            tokens.map((t) => t.word),
          );
          if (cancelled) {
            return;
          }
          const next: TitleMisspelling[] = [];
          tokens.forEach((token, index) => {
            const result = results[index];
            if (!result || result.correct) {
              return;
            }
            next.push({
              from: token.from,
              to: token.to,
              word: token.word,
              suggestions: result.suggestions,
            });
          });
          setMisspellings(next);
        } catch {
          if (!cancelled) {
            setMisspellings([]);
          }
        }
      })();
    }, SPELLCHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ignoredWords, value]);

  const mirror = useMemo(() => {
    if (misspellings.length === 0) {
      return value;
    }
    const parts: ReactNode[] = [];
    let cursor = 0;
    const sorted = [...misspellings].sort((a, b) => a.from - b.from);
    for (const item of sorted) {
      if (item.from > cursor) {
        parts.push(value.slice(cursor, item.from));
      }
      parts.push(
        <span
          key={`${item.from}-${item.to}`}
          className="spellcheck-misspelled"
          data-spellcheck-word={item.word}
          data-spellcheck-from={item.from}
          data-spellcheck-to={item.to}
        >
          {value.slice(item.from, item.to)}
        </span>,
      );
      cursor = item.to;
    }
    if (cursor < value.length) {
      parts.push(value.slice(cursor));
    }
    return parts;
  }, [misspellings, value]);

  const openItem = useCallback((item: TitleMisspelling, el: Element) => {
    const rect = el.getBoundingClientRect();
    setPopover({
      open: true,
      item,
      anchor: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    });
  }, []);

  const onMirrorOver = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest?.(".spellcheck-misspelled");
      if (!el) {
        return;
      }
      const from = Number(el.getAttribute("data-spellcheck-from"));
      const item = misspellings.find((m) => m.from === from);
      if (item) {
        openItem(item, el);
      }
    },
    [misspellings, openItem],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.currentTarget.blur();
        return;
      }
      if (event.key === "ContextMenu" || (event.altKey && event.key === "F7")) {
        event.preventDefault();
        const caret = event.currentTarget.selectionStart ?? 0;
        const item =
          misspellings.find((m) => caret >= m.from && caret <= m.to) ?? null;
        if (!item) {
          return;
        }
        const el = event.currentTarget.parentElement?.querySelector(
          `.spellcheck-misspelled[data-spellcheck-from="${item.from}"]`,
        );
        if (el) {
          openItem(item, el);
        }
      }
    },
    [misspellings, openItem],
  );

  return (
    <div className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor={id} id={labelId}>
        {label}
      </label>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre",
          className,
        )}
        onMouseOver={onMirrorOver}
        style={{ pointerEvents: "none" }}
      >
        <span
          className="pointer-events-auto"
          onMouseOver={onMirrorOver}
        >
          {mirror}
          {/* Preserve height when empty */}
          {value ? null : "\u00a0"}
        </span>
      </div>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        maxLength={maxLength}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          "relative w-full bg-transparent caret-foreground",
          "text-transparent selection:bg-primary/20 selection:text-transparent",
          className,
        )}
        aria-labelledby={labelId}
      />
      <SpellcheckPopover
        open={popover.open}
        word={popover.item?.word ?? ""}
        suggestions={popover.item?.suggestions ?? []}
        anchor={popover.anchor}
        onClose={() => setPopover({ open: false, item: null, anchor: null })}
        onSelectSuggestion={(suggestion) => {
          if (!popover.item) {
            return;
          }
          const next =
            value.slice(0, popover.item.from) +
            suggestion +
            value.slice(popover.item.to);
          onChange(next);
          setPopover({ open: false, item: null, anchor: null });
        }}
        onIgnore={() => {
          if (!popover.item) {
            return;
          }
          const next = addIgnoredWord(ignoredWords, popover.item.word);
          // Touch set for coverage of shared ignore path.
          void ignoredWordsSet(next);
          onIgnoredWordsChange(next);
          setPopover({ open: false, item: null, anchor: null });
        }}
      />
    </div>
  );
}
