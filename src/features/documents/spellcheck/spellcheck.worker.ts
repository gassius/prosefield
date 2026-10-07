/// <reference lib="webworker" />

import nspell from "nspell";
import {
  SPELLCHECK_DICT_AFF_URL,
  SPELLCHECK_DICT_DIC_URL,
  type SpellcheckWorkerRequest,
  type SpellcheckWorkerResponse,
  type SpellcheckWordResult,
} from "@/features/documents/spellcheck/worker-protocol";
import { SPELLCHECK_MAX_SUGGESTIONS } from "@/features/documents/spellcheck/constants";

declare const self: DedicatedWorkerGlobalScope;

let spell: ReturnType<typeof nspell> | null = null;
let initPromise: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (spell) {
    return;
  }
  if (!initPromise) {
    initPromise = (async () => {
      const [affRes, dicRes] = await Promise.all([
        fetch(SPELLCHECK_DICT_AFF_URL),
        fetch(SPELLCHECK_DICT_DIC_URL),
      ]);
      if (!affRes.ok || !dicRes.ok) {
        throw new Error("Failed to load spellcheck dictionary");
      }
      const aff = await affRes.text();
      const dic = await dicRes.text();
      spell = nspell({ aff, dic });
    })();
  }
  await initPromise;
}

function checkWords(words: string[]): SpellcheckWordResult[] {
  if (!spell) {
    throw new Error("Spellchecker not ready");
  }
  const checker = spell;
  const cache = new Map<string, SpellcheckWordResult>();
  const results: SpellcheckWordResult[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
      results.push({ ...cached, word });
      continue;
    }
    const correct = checker.correct(word);
    const suggestions = correct
      ? []
      : checker.suggest(word).slice(0, SPELLCHECK_MAX_SUGGESTIONS);
    const entry: SpellcheckWordResult = { word, correct, suggestions };
    cache.set(key, entry);
    results.push(entry);
  }
  return results;
}

function reply(message: SpellcheckWorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<SpellcheckWorkerRequest>) => {
  const msg = event.data;
  void (async () => {
    try {
      if (msg.type === "init") {
        await ensureReady();
        reply({ id: msg.id, type: "ready" });
        return;
      }
      if (msg.type === "check") {
        await ensureReady();
        reply({
          id: msg.id,
          type: "result",
          results: checkWords(msg.words),
        });
      }
    } catch (error) {
      reply({
        id: msg.id,
        type: "error",
        message: error instanceof Error ? error.message : "Spellcheck failed",
      });
    }
  })();
};
