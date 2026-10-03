/**
 * Runs under `node --import tsx --conditions react-server`.
 * Prints JSON: raw null-proto attrs become temporary-reference proxies;
 * production `plainTiptapJson` survives encodeReply/decodeReply.
 *
 * Bite: swapping `plainTiptapJson` for an identity function makes
 * `plainSchemaOk` false (this fixture must import the real helper).
 */
import { createRequire } from "node:module";
import { plainTiptapJson } from "../../../src/features/documents/schemas";

const require = createRequire(import.meta.url);
const {
  encodeReply,
  createTemporaryReferenceSet,
} = require("next/dist/compiled/react-server-dom-webpack/client.node");
const {
  decodeReply,
} = require("next/dist/compiled/react-server-dom-webpack/server.node");

async function roundTrip(value: unknown) {
  const temporaryReferences = createTemporaryReferenceSet();
  const body = await encodeReply(value, { temporaryReferences });
  return decodeReply(body, {}, { temporaryReferences });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function headingLevelOk(content: {
  content?: Array<{ type?: string; attrs?: { level?: unknown } }>;
}): boolean {
  try {
    const node = content?.content?.[0];
    if (!node || node.type !== "heading") {
      return false;
    }
    if (!isPlainObject(node.attrs)) {
      return false;
    }
    return node.attrs.level === 2;
  } catch {
    return false;
  }
}

function tipTapNullProtoContent() {
  // TipTap/ProseMirror getJSON() builds attrs with a null prototype.
  const headingAttrs = Object.assign(Object.create(null), { level: 2 });
  const orderedAttrs = Object.assign(Object.create(null), {
    start: 1,
    type: null,
  });
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: headingAttrs,
        content: [{ type: "text", text: "Section" }],
      },
      {
        type: "orderedList",
        attrs: orderedAttrs,
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "one" }],
              },
            ],
          },
        ],
      },
    ],
  };
}

const content = tipTapNullProtoContent();

const decodedRaw = await roundTrip({
  documentId: "abcABC1234567890wxyz",
  content,
});
const rawAttrs = decodedRaw.content.content[0].attrs;

// Production path used by DocumentEditor before Server Actions.
const plainContent = plainTiptapJson(content);
const decodedPlain = await roundTrip({
  documentId: "abcABC1234567890wxyz",
  content: plainContent,
});
const plainAttrs = decodedPlain.content.content[0].attrs;

process.stdout.write(
  JSON.stringify({
    rawAttrsType: typeof rawAttrs,
    rawSchemaOk: headingLevelOk(decodedRaw.content),
    plainAttrsType: typeof plainAttrs,
    plainLevel: isPlainObject(plainAttrs) ? plainAttrs.level : null,
    plainSchemaOk: headingLevelOk(decodedPlain.content),
    usedProductionPlainHelper: plainTiptapJson.name === "plainTiptapJson",
  }),
);
