/** Message protocol between the spellcheck client and Web Worker. */

export type SpellcheckWorkerRequest =
  | { id: number; type: "init" }
  | { id: number; type: "check"; words: string[] };

export type SpellcheckWordResult = {
  word: string;
  correct: boolean;
  suggestions: string[];
};

export type SpellcheckWorkerResponse =
  | { id: number; type: "ready" }
  | { id: number; type: "result"; results: SpellcheckWordResult[] }
  | { id: number; type: "error"; message: string };
