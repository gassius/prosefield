import type {
  SpellcheckWordResult,
  SpellcheckWorkerRequest,
  SpellcheckWorkerResponse,
} from "@/features/documents/spellcheck/worker-protocol";

type Pending = {
  resolve: (value: SpellcheckWorkerResponse) => void;
  reject: (reason: Error) => void;
};

/**
 * Lazy Web Worker host for nspell. Dictionary loads on first use, not in the
 * main bundle. Singleton per page — share across body + title checkers.
 */
class SpellcheckClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private ready: Promise<void> | null = null;

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }
    // Literal `new URL(..., import.meta.url)` required for bundler detection.
    const worker = new Worker(
      new URL("./spellcheck.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<SpellcheckWorkerResponse>) => {
      const msg = event.data;
      const entry = this.pending.get(msg.id);
      if (!entry) {
        return;
      }
      this.pending.delete(msg.id);
      entry.resolve(msg);
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || "Spellcheck worker error");
      for (const [, entry] of this.pending) {
        entry.reject(err);
      }
      this.pending.clear();
      this.worker = null;
      this.ready = null;
    };
    this.worker = worker;
    return worker;
  }

  private request(
    body: SpellcheckWorkerRequest,
  ): Promise<SpellcheckWorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(body.id, { resolve, reject });
      worker.postMessage(body);
    });
  }

  async init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const response = await this.request({
          id: this.nextId++,
          type: "init",
        });
        if (response.type === "error") {
          throw new Error(response.message);
        }
        if (response.type !== "ready") {
          throw new Error("Unexpected spellcheck worker response");
        }
      })().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
  }

  async checkWords(words: string[]): Promise<SpellcheckWordResult[]> {
    if (words.length === 0) {
      return [];
    }
    await this.init();
    const response = await this.request({
      id: this.nextId++,
      type: "check",
      words,
    });
    if (response.type === "error") {
      throw new Error(response.message);
    }
    if (response.type !== "result") {
      throw new Error("Unexpected spellcheck worker response");
    }
    return response.results;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const [, entry] of this.pending) {
      entry.reject(new Error("Spellcheck client disposed"));
    }
    this.pending.clear();
  }
}

let shared: SpellcheckClient | null = null;

export function getSpellcheckClient(): SpellcheckClient {
  if (!shared) {
    shared = new SpellcheckClient();
  }
  return shared;
}

/** Test-only: drop the shared client so the next call constructs a fresh one. */
export function __resetSpellcheckClientForTests(): void {
  shared?.dispose();
  shared = null;
}
