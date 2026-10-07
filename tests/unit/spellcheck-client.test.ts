import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetSpellcheckClientForTests,
  getSpellcheckClient,
} from "@/features/documents/spellcheck/spellcheck-client";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(public url: URL | string, public options?: WorkerOptions) {
    FakeWorker.instances.push(this);
  }

  postMessage(data: { id: number; type: string; words?: string[] }) {
    queueMicrotask(() => {
      if (data.type === "init") {
        this.onmessage?.({ data: { id: data.id, type: "ready" } } as MessageEvent);
        return;
      }
      if (data.type === "check") {
        const results = (data.words ?? []).map((word) => ({
          word,
          correct: word === "color",
          suggestions: word === "color" ? [] : ["color"],
        }));
        this.onmessage?.({
          data: { id: data.id, type: "result", results },
        } as MessageEvent);
      }
    });
  }

  terminate() {
    /* no-op */
  }
}

describe("SpellcheckClient", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
    __resetSpellcheckClientForTests();
  });

  afterEach(() => {
    __resetSpellcheckClientForTests();
    vi.unstubAllGlobals();
  });

  it("lazy-inits the worker and returns check results", async () => {
    const client = getSpellcheckClient();
    const results = await client.checkWords(["color", "colour"]);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(results).toEqual([
      { word: "color", correct: true, suggestions: [] },
      { word: "colour", correct: false, suggestions: ["color"] },
    ]);
    expect(await client.checkWords([])).toEqual([]);
  });

  it("shares one client instance until reset", () => {
    expect(getSpellcheckClient()).toBe(getSpellcheckClient());
    __resetSpellcheckClientForTests();
    expect(getSpellcheckClient()).not.toBeNull();
  });
});
