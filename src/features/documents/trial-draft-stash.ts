import {
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_CONTENT,
  type TiptapJson,
} from "@/features/documents/schemas";

/**
 * Client-only trial draft stash (sessionStorage), keyed by Firebase uid.
 * Survives the same-tab Stripe Checkout round trip. Never log contents.
 */

export type TrialDraft = {
  title: string;
  content: TiptapJson;
};

const KEY_PREFIX = "prosefield:trial-draft:";

export function trialDraftStorageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function isTiptapJson(value: unknown): value is TiptapJson {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

export function stashTrialDraft(uid: string, draft: TrialDraft): void {
  if (!canUseSessionStorage() || !uid) {
    return;
  }
  const title = draft.title.trim() || DEFAULT_DOCUMENT_TITLE;
  const content = draft.content ?? EMPTY_DOCUMENT_CONTENT;
  sessionStorage.setItem(
    trialDraftStorageKey(uid),
    JSON.stringify({ title, content } satisfies TrialDraft),
  );
}

export function readTrialDraft(uid: string): TrialDraft | null {
  if (!canUseSessionStorage() || !uid) {
    return null;
  }
  const raw = sessionStorage.getItem(trialDraftStorageKey(uid));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { title?: unknown }).title !== "string" ||
      !isTiptapJson((parsed as { content?: unknown }).content)
    ) {
      return null;
    }
    const title =
      (parsed as TrialDraft).title.trim() || DEFAULT_DOCUMENT_TITLE;
    return {
      title,
      content: (parsed as TrialDraft).content,
    };
  } catch {
    return null;
  }
}

export function clearTrialDraft(uid: string): void {
  if (!canUseSessionStorage() || !uid) {
    return;
  }
  sessionStorage.removeItem(trialDraftStorageKey(uid));
}

export function hasTrialDraft(uid: string): boolean {
  return readTrialDraft(uid) !== null;
}
