import {
  createDocumentInputSchema,
  type TiptapJson,
} from "@/features/documents/schemas";

/**
 * Client-only trial draft stash (sessionStorage), keyed by Firebase uid.
 * Survives the same-tab Stripe Checkout round trip. Never log contents.
 * Validates with the document schema (#25) on stash and restore.
 */

export type TrialDraft = {
  title: string;
  content: TiptapJson;
  /** Omitted on older stashes; schema defaults to []. */
  ignoredWords?: string[];
};

export type StashTrialDraftResult =
  | { ok: true; draft: TrialDraft }
  | { ok: false; reason: "invalid" | "unavailable" };

const KEY_PREFIX = "prosefield:trial-draft:";

export function trialDraftStorageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

export function isTrialDraftStorageKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

/**
 * Validate title+content with the same schema createDocumentAction uses.
 * Returns a normalised draft or null (never throws; never logs content).
 * Blank titles are coerced to the default so optional().default applies.
 */
export function validateTrialDraft(
  draft: unknown,
): TrialDraft | null {
  const raw =
    draft && typeof draft === "object"
      ? (draft as Record<string, unknown>)
      : {};
  const title =
    typeof raw.title === "string" && raw.title.trim() === ""
      ? undefined
      : raw.title;
  const parsed = createDocumentInputSchema.safeParse({ ...raw, title });
  if (!parsed.success) {
    return null;
  }
  // Schema already defaults blank/missing title+content+ignoredWords (#25).
  return {
    title: parsed.data.title,
    content: parsed.data.content,
    ignoredWords: parsed.data.ignoredWords,
  };
}

export function stashTrialDraft(
  uid: string,
  draft: TrialDraft,
): StashTrialDraftResult {
  if (!canUseSessionStorage() || !uid) {
    return { ok: false, reason: "unavailable" };
  }
  const validated = validateTrialDraft(draft);
  if (!validated) {
    return { ok: false, reason: "invalid" };
  }
  sessionStorage.setItem(
    trialDraftStorageKey(uid),
    JSON.stringify(validated satisfies TrialDraft),
  );
  return { ok: true, draft: validated };
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
    const validated = validateTrialDraft(parsed);
    if (!validated) {
      // Discard tampered / oversize / too-deep stash.
      sessionStorage.removeItem(trialDraftStorageKey(uid));
      return null;
    }
    return validated;
  } catch {
    sessionStorage.removeItem(trialDraftStorageKey(uid));
    return null;
  }
}

export function clearTrialDraft(uid: string): void {
  if (!canUseSessionStorage() || !uid) {
    return;
  }
  sessionStorage.removeItem(trialDraftStorageKey(uid));
}

/** Clear every uid-scoped trial draft key (sign-out / shared-device hygiene). */
export function clearAllTrialDrafts(): void {
  if (!canUseSessionStorage()) {
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && isTrialDraftStorageKey(key)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    sessionStorage.removeItem(key);
  }
}

/**
 * After login/session exchange: drop stashes that belong to a different uid
 * (session expiry → new login, or shared-device hygiene).
 */
export function clearTrialDraftsNotForUid(uid: string): void {
  if (!canUseSessionStorage() || !uid) {
    clearAllTrialDrafts();
    return;
  }
  const keep = trialDraftStorageKey(uid);
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && isTrialDraftStorageKey(key) && key !== keep) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    sessionStorage.removeItem(key);
  }
}
