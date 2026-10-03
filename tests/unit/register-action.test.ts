import { beforeEach, describe, expect, it, vi } from "vitest";
import { siteCopy } from "@/content/site";

const createUser = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    createUser: (...args: unknown[]) => createUser(...args),
  }),
}));

describe("registerAction (server entry point)", () => {
  beforeEach(() => {
    createUser.mockReset();
    vi.resetModules();
  });

  it("rejects a 7-character password without calling Admin createUser", async () => {
    const { registerAction } = await import("@/features/auth/register");
    const short = "abcdefg";
    expect(short).toHaveLength(7);

    const result = await registerAction({
      email: "short@example.com",
      password: short,
    });

    expect(result).toEqual({
      ok: false,
      field: "password",
      message: siteCopy.auth.passwordHint,
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("accepts an 8-character password and creates the user via Admin SDK", async () => {
    createUser.mockResolvedValue({ uid: "uid-1" });
    const { registerAction } = await import("@/features/auth/register");

    const result = await registerAction({
      email: "  ok@example.com  ",
      password: "abcdefgh",
    });

    expect(result).toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith({
      email: "ok@example.com",
      password: "abcdefgh",
    });
  });

  it("maps Admin email-already-exists to the generic auth error", async () => {
    createUser.mockRejectedValue({ code: "auth/email-already-exists" });
    const { registerAction } = await import("@/features/auth/register");

    const result = await registerAction({
      email: "dup@example.com",
      password: "password1",
    });

    expect(result).toEqual({
      ok: false,
      message: siteCopy.auth.genericError,
    });
  });

  it("maps Admin invalid-password to the password hint", async () => {
    createUser.mockRejectedValue({ code: "auth/invalid-password" });
    const { registerAction } = await import("@/features/auth/register");

    const result = await registerAction({
      email: "weak@example.com",
      password: "password1",
    });

    expect(result).toEqual({
      ok: false,
      field: "password",
      message: siteCopy.auth.passwordHint,
    });
  });

  it("rejects an invalid email before createUser", async () => {
    const { registerAction } = await import("@/features/auth/register");
    const result = await registerAction({
      email: "not-an-email",
      password: "password1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("email");
      expect(result.message).toBe("Enter a valid email address.");
    }
    expect(createUser).not.toHaveBeenCalled();
  });

  it("maps unknown Admin errors without a code to the generic message", async () => {
    createUser.mockRejectedValue("boom");
    const { registerAction } = await import("@/features/auth/register");
    const result = await registerAction({
      email: "x@example.com",
      password: "password1",
    });
    expect(result).toEqual({
      ok: false,
      message: siteCopy.auth.genericError,
    });
  });

  it("maps coded Admin errors other than email/password specials", async () => {
    createUser.mockRejectedValue({ code: "auth/too-many-requests" });
    const { registerAction } = await import("@/features/auth/register");
    const result = await registerAction({
      email: "x@example.com",
      password: "password1",
    });
    expect(result).toEqual({
      ok: false,
      message: siteCopy.auth.genericError,
    });
  });

  it("returns a generic error when zod fails without email/password path issues", async () => {
    const { registerInputSchema } = await import(
      "@/features/auth/register-input"
    );
    const { registerAction } = await import("@/features/auth/register");
    const original = registerInputSchema.safeParse;
    registerInputSchema.safeParse = () =>
      ({
        success: false,
        error: { issues: [{ path: ["other"], message: "nope" }] },
      }) as ReturnType<typeof original>;
    try {
      const result = await registerAction({
        email: "x@example.com",
        password: "password1",
      });
      expect(result).toEqual({
        ok: false,
        message: siteCopy.auth.genericError,
      });
    } finally {
      registerInputSchema.safeParse = original;
    }
  });

  it("falls back when password/email zod issues omit messages", async () => {
    const { registerInputSchema } = await import(
      "@/features/auth/register-input"
    );
    const { registerAction } = await import("@/features/auth/register");
    const original = registerInputSchema.safeParse;

    registerInputSchema.safeParse = () =>
      ({
        success: false,
        error: { issues: [{ path: ["password"] }] },
      }) as ReturnType<typeof original>;
    try {
      const passwordResult = await registerAction({
        email: "x@example.com",
        password: "x",
      });
      expect(passwordResult).toEqual({
        ok: false,
        field: "password",
        message: siteCopy.auth.passwordHint,
      });
    } finally {
      registerInputSchema.safeParse = original;
    }

    registerInputSchema.safeParse = () =>
      ({
        success: false,
        error: { issues: [{ path: ["email"] }] },
      }) as ReturnType<typeof original>;
    try {
      const emailResult = await registerAction({
        email: "bad",
        password: "password1",
      });
      expect(emailResult).toEqual({
        ok: false,
        field: "email",
        message: "Enter a valid email address.",
      });
    } finally {
      registerInputSchema.safeParse = original;
    }
  });
});
