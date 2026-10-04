import { describe, expect, it } from "vitest";
import { redactForLog } from "@/lib/crypto/redact";
import { PII_INVENTORY } from "@/lib/crypto/pii-inventory";

describe("redactForLog", () => {
  it("redacts emails, passwords, and document content fields", () => {
    const redacted = redactForLog({
      email: "alice@example.com",
      password: "super-secret",
      content: { type: "doc", text: "private notes" },
      title: "Secret title",
      nested: {
        message: "Contact bob@example.com please",
        token: "abc",
      },
      ok: true,
      count: 2,
    }) as Record<string, unknown>;

    expect(redacted.email).toBe("[REDACTED]");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.content).toBe("[REDACTED]");
    expect(redacted.title).toBe("[REDACTED]");
    expect(redacted.ok).toBe(true);
    expect(redacted.count).toBe(2);
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.message).toBe("Contact [REDACTED] please");
    expect(nested.token).toBe("[REDACTED]");
  });

  it("redacts Error messages and deep arrays", () => {
    const err = new Error("failed for eve@example.com");
    const redacted = redactForLog({
      error: err,
      items: ["x", { password: "p" }],
    }) as {
      error: { message: string };
      items: unknown[];
    };
    expect(redacted.error.message).toContain("[REDACTED]");
    expect(redacted.error.message).not.toContain("eve@");
    expect(redacted.items[1]).toEqual({ password: "[REDACTED]" });
  });

  it("lists the minimal PII inventory", () => {
    const fields = PII_INVENTORY.map((row) => row.field);
    expect(fields).toContain("email");
    expect(fields).toContain("password");
    expect(fields).toContain("document.content");
    expect(
      PII_INVENTORY.find((row) => row.field === "email")?.firestore,
    ).toBe("never");
  });
});
