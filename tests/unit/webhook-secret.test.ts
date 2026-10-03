import { describe, expect, it, vi } from "vitest";
import { StripeSetupError } from "@/lib/stripe/setup";
import {
  logStripeSetupFailure,
  printWebhookSecret,
  scrubStripeSecrets,
  STRIPE_PRINT_SECRET_DOCKER_ARGS,
  type ExecFileFn,
} from "@/lib/stripe/webhook-secret";
import {
  FAKE_STRIPE_RESTRICTED_KEY,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

describe("STRIPE_PRINT_SECRET_DOCKER_ARGS", () => {
  it("pins exact docker compose run --rm stripe-cli listen --print-secret argv", () => {
    expect([...STRIPE_PRINT_SECRET_DOCKER_ARGS]).toEqual([
      "compose",
      "run",
      "--rm",
      "stripe-cli",
      "listen",
      "--print-secret",
    ]);
  });
});

describe("scrubStripeSecrets", () => {
  it("redacts whsec_ / sk_test_ / rk_test_ shaped tokens", () => {
    const raw = `fail ${FAKE_STRIPE_WEBHOOK_SECRET} ${FAKE_STRIPE_SECRET_KEY} ${FAKE_STRIPE_RESTRICTED_KEY}`;
    const scrubbed = scrubStripeSecrets(raw);
    expect(scrubbed).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
    expect(scrubbed).not.toContain(FAKE_STRIPE_SECRET_KEY);
    expect(scrubbed).not.toContain(FAKE_STRIPE_RESTRICTED_KEY);
    expect(scrubbed).toContain("whsec_[redacted]");
    expect(scrubbed).toContain("sk_[redacted]");
    expect(scrubbed).toContain("rk_[redacted]");
  });
});

describe("printWebhookSecret", () => {
  it("invokes docker with the exact compose argv and prefers stdout", async () => {
    const execFile = vi.fn<ExecFileFn>().mockResolvedValue({
      stdout: `${FAKE_STRIPE_WEBHOOK_SECRET}\n`,
      stderr: "noise",
    });

    const secret = await printWebhookSecret(execFile);

    expect(secret).toBe(FAKE_STRIPE_WEBHOOK_SECRET);
    expect(execFile).toHaveBeenCalledOnce();
    const [file, args] = execFile.mock.calls[0]!;
    expect(file).toBe("docker");
    expect(args).toEqual([...STRIPE_PRINT_SECRET_DOCKER_ARGS]);
    expect(args).toContain("--print-secret");
    expect(args).toContain("--rm");
    expect(args).toContain("run");
    expect(args).not.toContain("up");
  });

  it("falls back to stderr when stdout is empty", async () => {
    const execFile = vi.fn<ExecFileFn>().mockResolvedValue({
      stdout: "   \n",
      stderr: `${FAKE_STRIPE_WEBHOOK_SECRET}\r\n`,
    });
    await expect(printWebhookSecret(execFile)).resolves.toBe(
      FAKE_STRIPE_WEBHOOK_SECRET,
    );
  });

  it("scrubs secrets when execFile rejects and never returns raw child output", async () => {
    const execFile = vi.fn<ExecFileFn>().mockRejectedValue(
      new Error(
        `docker failed: ${FAKE_STRIPE_WEBHOOK_SECRET} ${FAKE_STRIPE_SECRET_KEY}`,
      ),
    );

    let thrown: unknown;
    try {
      await printWebhookSecret(execFile);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StripeSetupError);
    const message = (thrown as Error).message;
    expect(message).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
    expect(message).not.toContain(FAKE_STRIPE_SECRET_KEY);
    expect(message).toContain("whsec_[redacted]");
    expect(message).toContain("sk_[redacted]");
    expect(message).toMatch(/print-secret/);
  });

  it("does not log child stdout on success (caller must not print the secret)", async () => {
    const logs: string[] = [];
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const execFile = vi.fn<ExecFileFn>().mockResolvedValue({
      stdout: FAKE_STRIPE_WEBHOOK_SECRET,
      stderr: "",
    });
    try {
      const secret = await printWebhookSecret(execFile);
      // Simulate setup log path: status only, never the secret value.
      logs.push("Updated STRIPE_WEBHOOK_SECRET in .env");
      expect(secret).toBe(FAKE_STRIPE_WEBHOOK_SECRET);
      expect(logs.join("\n")).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      for (const call of consoleLog.mock.calls) {
        expect(String(call[0])).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
      }
    } finally {
      consoleLog.mockRestore();
      consoleError.mockRestore();
    }
  });
});

describe("logStripeSetupFailure", () => {
  it("redacts whsec_ / sk_ / rk_ tokens on the error log path", () => {
    const lines: string[] = [];
    logStripeSetupFailure(
      new Error(
        `boom ${FAKE_STRIPE_WEBHOOK_SECRET} ${FAKE_STRIPE_SECRET_KEY} ${FAKE_STRIPE_RESTRICTED_KEY}`,
      ),
      (message) => lines.push(message),
    );
    const joined = lines.join("\n");
    expect(joined).toMatch(/^stripe:setup failed:/);
    expect(joined).not.toContain(FAKE_STRIPE_WEBHOOK_SECRET);
    expect(joined).not.toContain(FAKE_STRIPE_SECRET_KEY);
    expect(joined).not.toContain(FAKE_STRIPE_RESTRICTED_KEY);
    expect(joined).toContain("whsec_[redacted]");
    expect(joined).toContain("sk_[redacted]");
    expect(joined).toContain("rk_[redacted]");
  });
});
