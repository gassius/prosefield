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
    // Second check reuses the ready worker.
    expect(await client.checkWords(["color"])).toEqual([
      { word: "color", correct: true, suggestions: [] },
    ]);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("shares one client instance until reset", () => {
    expect(getSpellcheckClient()).toBe(getSpellcheckClient());
    __resetSpellcheckClientForTests();
    expect(getSpellcheckClient()).not.toBeNull();
  });

  it("surfaces worker error responses", async () => {
    class ErrorWorker extends FakeWorker {
      postMessage(data: { id: number; type: string }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: { id: data.id, type: "error", message: "boom" },
          } as MessageEvent);
        });
      }
    }
    vi.stubGlobal("Worker", ErrorWorker);
    __resetSpellcheckClientForTests();
    await expect(getSpellcheckClient().checkWords(["x"])).rejects.toThrow(
      "boom",
    );
  });

  it("rejects unexpected init and check response types", async () => {
    class WeirdInitWorker extends FakeWorker {
      postMessage(data: { id: number; type: string; words?: string[] }) {
        queueMicrotask(() => {
          if (data.type === "init") {
            this.onmessage?.({
              data: { id: data.id, type: "result", results: [] },
            } as MessageEvent);
            return;
          }
          FakeWorker.prototype.postMessage.call(this, data);
        });
      }
    }
    vi.stubGlobal("Worker", WeirdInitWorker);
    __resetSpellcheckClientForTests();
    await expect(getSpellcheckClient().checkWords(["x"])).rejects.toThrow(
      /Unexpected spellcheck worker response/,
    );

    class WeirdCheckWorker extends FakeWorker {
      postMessage(data: { id: number; type: string; words?: string[] }) {
        queueMicrotask(() => {
          if (data.type === "init") {
            this.onmessage?.({
              data: { id: data.id, type: "ready" },
            } as MessageEvent);
            return;
          }
          this.onmessage?.({
            data: { id: data.id, type: "ready" },
          } as MessageEvent);
        });
      }
    }
    vi.stubGlobal("Worker", WeirdCheckWorker);
    __resetSpellcheckClientForTests();
    await expect(getSpellcheckClient().checkWords(["x"])).rejects.toThrow(
      /Unexpected spellcheck worker response/,
    );
  });

  it("rejects pending requests on worker error and ignores orphan messages", async () => {
    class HangWorker extends FakeWorker {
      postMessage(_data: { id: number; type: string }) {
        // Leave pending until onerror / orphan message.
      }
    }
    vi.stubGlobal("Worker", HangWorker);
    __resetSpellcheckClientForTests();
    const client = getSpellcheckClient();
    const pending = client.checkWords(["hang"]);
    const worker = FakeWorker.instances[0]!;

    // Orphan message (unknown id) is ignored.
    worker.onmessage?.({
      data: { id: 9999, type: "ready" },
    } as MessageEvent);

    worker.onerror?.({ message: "worker crashed" } as ErrorEvent);
    await expect(pending).rejects.toThrow(/worker crashed/);

    // After onerror the client can re-init.
    class RecoverWorker extends FakeWorker {}
    vi.stubGlobal("Worker", RecoverWorker);
    await expect(client.checkWords(["color"])).resolves.toEqual([
      { word: "color", correct: true, suggestions: [] },
    ]);
  });

  it("rejects pending requests when disposed", async () => {
    class HangWorker extends FakeWorker {
      postMessage(_data: { id: number; type: string }) {
        /* hang */
      }
      terminate = vi.fn();
    }
    vi.stubGlobal("Worker", HangWorker);
    __resetSpellcheckClientForTests();
    const client = getSpellcheckClient();
    const pending = client.checkWords(["hang"]);
    client.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
    expect((FakeWorker.instances[0] as HangWorker).terminate).toHaveBeenCalled();
    // dispose with no worker is a no-op
    client.dispose();
  });

  it("rejects check error responses after ready", async () => {
    class CheckErrorWorker extends FakeWorker {
      postMessage(data: { id: number; type: string; words?: string[] }) {
        queueMicrotask(() => {
          if (data.type === "init") {
            this.onmessage?.({
              data: { id: data.id, type: "ready" },
            } as MessageEvent);
            return;
          }
          this.onmessage?.({
            data: { id: data.id, type: "error", message: "check failed" },
          } as MessageEvent);
        });
      }
    }
    vi.stubGlobal("Worker", CheckErrorWorker);
    __resetSpellcheckClientForTests();
    await expect(getSpellcheckClient().checkWords(["x"])).rejects.toThrow(
      "check failed",
    );
  });

  it("uses a default message when worker onerror has none", async () => {
    class HangWorker extends FakeWorker {
      postMessage(_data: { id: number; type: string }) {
        /* hang */
      }
    }
    vi.stubGlobal("Worker", HangWorker);
    __resetSpellcheckClientForTests();
    const client = getSpellcheckClient();
    const pending = client.checkWords(["hang"]);
    FakeWorker.instances[0]!.onerror?.({ message: "" } as ErrorEvent);
    await expect(pending).rejects.toThrow(/Spellcheck worker error/);
  });
});
