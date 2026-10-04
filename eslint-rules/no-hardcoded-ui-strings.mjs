/**
 * Forbid hard-coded UI string literals in JSX outside `src/content/site.ts`.
 * Catches raw JSX text, string literals in JSX expression containers, and
 * UI-facing JSX attribute string literals (`aria-label`, `title`,
 * `placeholder`, `alt`).
 *
 * Allow-list via leading comment: `eslint-disable-next-line prosefield/no-hardcoded-ui-strings`
 * or the `allowedStrings` option for tiny punctuation-only tokens.
 */

const UI_STRING_ATTRIBUTES = new Set([
  "aria-label",
  "title",
  "placeholder",
  "alt",
]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hard-coded UI strings in JSX; use siteCopy from content/site.ts",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedStrings: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcoded:
        'Hard-coded UI string "{{text}}" — move it to src/content/site.ts (siteCopy).',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allowed = new Set(
      (options.allowedStrings ?? []).map((s) => s.trim()),
    );

    function report(node, text) {
      const trimmed = text.trim();
      if (!trimmed || allowed.has(trimmed)) {
        return;
      }
      context.report({
        node,
        messageId: "hardcoded",
        data: { text: trimmed.slice(0, 80) },
      });
    }

    return {
      JSXText(node) {
        report(node, node.value);
      },
      JSXExpressionContainer(node) {
        const expr = node.expression;
        if (expr?.type === "Literal" && typeof expr.value === "string") {
          report(expr, expr.value);
        }
        if (
          expr?.type === "TemplateLiteral" &&
          expr.expressions.length === 0 &&
          expr.quasis.length === 1
        ) {
          report(expr, expr.quasis[0]?.value?.cooked ?? "");
        }
      },
      JSXAttribute(node) {
        const name = node.name;
        const attrName =
          name?.type === "JSXIdentifier"
            ? name.name
            : name?.type === "JSXNamespacedName"
              ? `${name.namespace.name}:${name.name.name}`
              : null;
        if (!attrName || !UI_STRING_ATTRIBUTES.has(attrName)) {
          return;
        }
        const value = node.value;
        if (value?.type === "Literal" && typeof value.value === "string") {
          report(value, value.value);
        }
        if (
          value?.type === "JSXExpressionContainer" &&
          value.expression?.type === "Literal" &&
          typeof value.expression.value === "string"
        ) {
          report(value.expression, value.expression.value);
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: "prosefield", version: "1.0.0" },
  rules: {
    "no-hardcoded-ui-strings": rule,
  },
};

export default plugin;
