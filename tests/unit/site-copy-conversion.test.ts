import { describe, expect, it } from "vitest";
import { brandTagline, siteCopy } from "@/content/site";

/**
 * Pins conversion-facing landing strings (ClickUp 869fbfq82).
 * Fails if old technical FAQ/privacy wording or the old secondary CTA returns.
 */
describe("landing conversion copy", () => {
  it("uses one tagline in the hero and footer", () => {
    expect(brandTagline).toBe("A focused home for your writing");
    expect(siteCopy.home.eyebrow).toBe(brandTagline);
    expect(siteCopy.brand.promise).toBe(brandTagline);
  });

  it("labels the benefits-scroll CTA Why Prosefield", () => {
    expect(siteCopy.home.explore).toBe("Why Prosefield");
    expect(siteCopy.home.explore).not.toBe("Explore the editor");
  });

  it("answers FAQ privacy in user-benefit language", () => {
    const answer = siteCopy.faq.items.find((item) => item.id === "private")
      ?.answer;
    expect(answer).toBe(
      "Yes. Your documents stay private to your account—only you can open and edit them.",
    );
    expect(answer).not.toMatch(/Firestore/i);
    expect(answer).not.toMatch(/browser cannot read/i);
    expect(answer).not.toMatch(/checked on the server/i);
  });

  it("answers FAQ subscribe with focused-editor benefit language", () => {
    const answer = siteCopy.faq.items.find((item) => item.id === "subscribe")
      ?.answer;
    expect(answer).toBe(
      "You get access to an incredible text editor that keeps you focused, with your private documents waiting whenever you return.",
    );
    expect(answer).not.toMatch(/webhook/i);
    expect(answer).not.toMatch(/Stripe confirms payment/i);
  });

  it("answers FAQ mobile around the editor working", () => {
    const answer = siteCopy.faq.items.find((item) => item.id === "mobile")
      ?.answer;
    expect(answer).toBe(
      "Yes. The editor works on phones, tablets and desktops, so you can write wherever you are.",
    );
    expect(answer).not.toMatch(/landing page/i);
    expect(answer).not.toMatch(/document list/i);
  });

  it("keeps privacy copy plain and reassuring", () => {
    expect(siteCopy.footer.privacyBody).toBe(
      "Your writing stays private to your account. We keep it secure so only you can open and edit your documents.",
    );
    expect(siteCopy.footer.privacyBody).not.toMatch(/Firebase/i);
    expect(siteCopy.footer.privacyBody).not.toMatch(/Firestore/i);
    expect(siteCopy.footer.privacyBody).not.toMatch(/browser Firestore/i);
  });
});
