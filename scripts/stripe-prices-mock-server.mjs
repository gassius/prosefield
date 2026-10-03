#!/usr/bin/env node
/**
 * Minimal local Stripe API stub for CI visual job.
 * Answers GET /v1/prices/:id so getPlan() never hits api.stripe.com.
 *
 * Env: STRIPE_API_PORT (default 12111), STRIPE_MOCK_PRICE_ID (optional).
 */
import http from "node:http";

const port = Number(process.env.STRIPE_API_PORT ?? "12111");
const host = process.env.STRIPE_API_HOST ?? "127.0.0.1";

function pricePayload(id) {
  return {
    id,
    object: "price",
    active: true,
    currency: "eur",
    unit_amount: 800,
    type: "recurring",
    recurring: { interval: "month", interval_count: 1 },
    product: {
      id: "prod_visualbaseline01",
      object: "product",
      active: true,
      name: "Prosefield",
      deleted: false,
    },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);
  const match = url.pathname.match(/^\/v1\/prices\/([^/]+)$/);
  if (req.method === "GET" && match) {
    const id = decodeURIComponent(match[1] ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(pricePayload(id)));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { type: "invalid_request_error", message: "not found" } }));
});

server.listen(port, host, () => {
  process.stdout.write(`stripe-prices-mock listening on ${host}:${port}\n`);
});
