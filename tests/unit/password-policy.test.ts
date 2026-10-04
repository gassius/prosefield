import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/constants";
import {
  assertRegisterPassword,
  registerPasswordSchema,
} from "@/features/auth/password";
import { siteCopy } from "@/content/site";

describe("register password policy (shared schema)", () => {
  it("rejects a 7-character password", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    const short = "abcdefg";
    expect(short).toHaveLength(7);

    const result = assertRegisterPassword(short);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(siteCopy.auth.passwordHint);
    }

    const parsed = registerPasswordSchema.safeParse(short);
    expect(parsed.success).toBe(false);
  });

  it("rejects the reported 6-character Firebase-default password 123456", () => {
    const short = "123456";
    expect(short).toHaveLength(6);
    expect(assertRegisterPassword(short)).toEqual({
      ok: false,
      message: siteCopy.auth.passwordHint,
    });
    expect(registerPasswordSchema.safeParse(short).success).toBe(false);
  });

  it("accepts an 8-character password", () => {
    const ok = assertRegisterPassword("abcdefgh");
    expect(ok).toEqual({ ok: true, password: "abcdefgh" });
  });

  it("keeps the hint text in sync with PASSWORD_MIN_LENGTH", () => {
    expect(siteCopy.auth.passwordHint).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  });

  it("falls back to siteCopy hint when zod omits issue messages", () => {
    const original = registerPasswordSchema.safeParse;
    // Force the || siteCopy.auth.passwordHint branch.
    (registerPasswordSchema as { safeParse: typeof original }).safeParse = () =>
      ({
        success: false,
        error: { issues: [{}] },
      }) as ReturnType<typeof original>;
    try {
      const result = assertRegisterPassword("x");
      expect(result).toEqual({
        ok: false,
        message: siteCopy.auth.passwordHint,
      });
    } finally {
      (registerPasswordSchema as { safeParse: typeof original }).safeParse =
        original;
    }
  });
});

