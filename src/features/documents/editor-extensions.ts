/**
 * Shared Prosefield Tiptap StarterKit config (Architecture §5.5).
 * Allow-list: paragraph, H2, H3, lists, quote, bold, italic, history.
 * hardBreak kept for Shift+Enter; link/underline/code/strike/hr disabled.
 */
import StarterKit from "@tiptap/starter-kit";
import { prosefieldStarterKitOptions } from "@/features/documents/schemas";
import {
  createSpellcheckExtension,
  type SpellcheckExtensionOptions,
} from "@/features/documents/spellcheck/spellcheck-extension";

export function createProsefieldStarterKit() {
  return StarterKit.configure(prosefieldStarterKitOptions);
}

export function createProsefieldSpellcheck(
  options: SpellcheckExtensionOptions = {},
) {
  return createSpellcheckExtension(options);
}
