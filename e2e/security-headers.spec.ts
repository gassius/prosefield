import { test, expect, type Page, type Response } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  registerViaUi,
  resetEmulators,
  seedSubscriptionProjection,
  uniqueEmail,
} from "./helpers";

function extractNonce(csp: string): string {
  const match = csp.match(/'nonce-([^']+)'/);
  expect(match?.[1], `CSP missing nonce: ${csp}`).toBeTruthy();
  return match![1]!;
}

async function installCspViolationCapture(page: Page): Promise<string[]> {
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
  return violations;
}

async function assertCspClean(
  page: Page,
  response: Response | null,
  consoleViolations: string[],
): Promise<string> {
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

  const headerNonce = extractNonce(csp);
  // Browsers hide the nonce *content* attribute from getAttribute / CSS; assert
  // against the response HTML and the IDL `.nonce` property instead.
  const html = await response!.text();
  const htmlNonceRe = new RegExp(
    `<script[^>]*\\snonce=["']${headerNonce.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "i",
  );
  expect(html).toMatch(htmlNonceRe);

  const scriptNonces = await page.locator("script[nonce]").evaluateAll((nodes) =>
    nodes.map((n) => {
      const el = n as HTMLScriptElement;
      return el.nonce || "";
    }),
  );
  expect(scriptNonces.length).toBeGreaterThan(0);
  for (const nonce of scriptNonces) {
    expect(nonce).toBe(headerNonce);
  }

  const pageViolations = await page.evaluate(
    () =>
      (window as unknown as { __cspViolations?: string[] }).__cspViolations ??
      [],
  );
  expect(pageViolations).toEqual([]);
  expect(consoleViolations).toEqual([]);
  return headerNonce;
}

test.describe("transport security headers", () => {
  test("serves HSTS/CSP with fresh nonces and no CSP violations on key routes", async ({
    page,
  }) => {
    await resetEmulators();
    const consoleViolations = await installCspViolationCapture(page);

    const landing = await page.goto("/");
    const landingNonce = await assertCspClean(
      page,
      landing,
      consoleViolations,
    );
    await expect(
      page.getByRole("link", { name: /Prosefield/i }).first(),
    ).toBeVisible();

    const login = await page.goto("/login");
    const loginNonce = await assertCspClean(page, login, consoleViolations);
    expect(loginNonce).not.toBe(landingNonce);

    const notFound = await page.goto("/this-route-does-not-exist-csp");
    const notFoundNonce = await assertCspClean(
      page,
      notFound,
      consoleViolations,
    );
    expect(notFoundNonce).not.toBe(loginNonce);

    const email = uniqueEmail("csp");
    const password = "password-123";
    await registerViaUi(page, email, password);
    await expectSignedIn(page, email);

    const subscribe = await page.goto("/subscribe");
    const subscribeNonce = await assertCspClean(
      page,
      subscribe,
      consoleViolations,
    );
    expect(subscribeNonce).not.toBe(notFoundNonce);

    const uid = await lookupUidByEmail(email, password);
    await seedSubscriptionProjection(uid, "active");
    await page.goto("/documents");
    await page.getByRole("button", { name: "New document" }).click();
    await expect(page).toHaveURL(/\/documents\/[^/]+/);
    // Re-navigate so we capture the document editor response headers.
    const editorUrl = page.url();
    const editor = await page.goto(editorUrl);
    const editorNonce = await assertCspClean(page, editor, consoleViolations);
    expect(editorNonce).not.toBe(subscribeNonce);
    await expect(page.locator(".ProseMirror, [contenteditable='true']").first()).toBeVisible();
  });
});
