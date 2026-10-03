/**
 * Runs under `node --conditions react-server`.
 * Prints JSON: raw null-proto attrs become temporary-reference proxies;
 * plainTiptapJson (JSON clone) survives encodeReply/decodeReply.
 */
const {
  encodeReply,
  createTemporaryReferenceSet,
} = require("next/dist/compiled/react-server-dom-webpack/client.node");
const {
  decodeReply,
} = require("next/dist/compiled/react-server-dom-webpack/server.node");

async function roundTrip(value) {
  const temporaryReferences = createTemporaryReferenceSet();
  const body = await encodeReply(value, { temporaryReferences });
  return decodeReply(body, {}, { temporaryReferences });
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function headingLevelOk(content) {
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

(async () => {
  const nullProtoAttrs = Object.assign(Object.create(null), { level: 2 });
  const content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: nullProtoAttrs,
        content: [{ type: "text", text: "Section" }],
      },
    ],
  };

  const decodedRaw = await roundTrip({
    documentId: "abcABC1234567890wxyz",
    content,
  });
  const rawAttrs = decodedRaw.content.content[0].attrs;

  const plainContent = JSON.parse(JSON.stringify(content));
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
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
