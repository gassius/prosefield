import { test, expect } from "@playwright/test";

test.describe("transport security headers", () => {
  test("serves HSTS/CSP and records no CSP violations on landing", async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /content security policy/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (/content security policy/i.test(err.message)) {
        violations.push(err.message);
      }
    });

    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (
          window as unknown as { __cspViolations?: string[] }
        ).__cspViolations = [
          ...((window as unknown as { __cspViolations?: string[] })
            .__cspViolations ?? []),
          `${event.violatedDirective}:${event.blockedURI}`,
        ];
      });
    });

    const response = await page.goto("/");
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers["strict-transport-security"] ?? "").toMatch(/max-age=/);
    const csp =
      headers["content-security-policy"] ??
      headers["Content-Security-Policy"] ??
      "";
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
    expect(csp).toMatch(/upgrade-insecure-requests/);
    expect(csp).toMatch(/'nonce-/);
    expect(csp).toMatch(/strict-dynamic/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

    await expect(page.getByRole("link", { name: /Prosefield/i }).first()).toBeVisible();

    const pageViolations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations?: string[] }).__cspViolations ??
        [],
    );
    expect(pageViolations).toEqual([]);
    expect(violations).toEqual([]);
  });
});
