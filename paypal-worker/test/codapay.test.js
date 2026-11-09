import test from "node:test";
import assert from "node:assert/strict";
import md5 from "js-md5";
import worker from "../src/index.js";

const transactionId = "7942474221915036816";
const secret = "test-only-secret";
function setup() {
  let saved;
  let upstream;
  const env = {
    CODAPAY_API_KEY: secret, CODAPAY_ENV: "production", CODAPAY_PROJECT_ID: "3912", CODAPAY_CHECKOUT_ENABLED: "true",
    DB: { prepare(sql) { return { bind(...v) { return {
      async first() {
        if (sql.startsWith("SELECT request_count")) return { request_count: 1 };
        if (sql.startsWith("SELECT order_id")) return saved && { order_id: saved.orderId, amount_cents: saved.amount, currency: saved.currency };
      },
      async run() {
        if (sql.startsWith("INSERT INTO codapay_orders")) saved = { txnId: v[0], orderId: v[1], email: v[2], amount: v[3], currency: v[4], raw: JSON.parse(v[5]) };
        if (sql.startsWith("UPDATE codapay_orders")) { saved.status = v[0]; saved.raw.inquiry = JSON.parse(v[2]); }
      }
    }; } }; } }
  };
  return { env, get saved() { return saved; }, set upstream(value) { upstream = value; }, get upstream() { return upstream; } };
}
async function create(ctx) {
  return worker.fetch(new Request("https://pay.example/api/codapay/payments", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "buyer@example.com", items: [{ id: "model-edit-basic", qty: 2, price: 0.01 }] })
  }), ctx.env);
}
async function status(ctx) {
  return worker.fetch(new Request("https://pay.example/api/codapay/payment-status", {
    method: "POST", body: JSON.stringify({ txnId: transactionId, orderId: ctx.saved.orderId })
  }), ctx.env);
}
test("new Codapay checkouts are paused unless explicitly enabled", async () => {
  const ctx = setup();
  delete ctx.env.CODAPAY_CHECKOUT_ENABLED;
  const response = await create(ctx);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "checkout_paused");
  assert.equal(ctx.saved, undefined);
});
test("Codapay creates a server-priced order with the current return URL and persists items", async () => {
  const ctx = setup(), original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    ctx.upstream = JSON.parse(options.body).initRequest;
    return new Response(`{"initResult":{"resultCode":0,"txnId":${transactionId},"redirectUrl":"https://airtime.codapayments.com/airtime/begin?txn_id=${transactionId}"}}`);
  };
  try {
    const response = await create(ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).txnId, transactionId);
    assert.equal(ctx.saved.amount, 2000);
    assert.equal(ctx.saved.raw.items[0].quantity, "2");
    assert.equal(ctx.upstream.items.reduce((s, item) => s + item.price, 0), 20);
    assert.match(ctx.upstream.profile.entry.find((entry) => entry.key === "return_url").value, /^https:\/\/epoch-shop\.com\//);
  } finally { globalThis.fetch = original; }
});
test("Codapay confirms the saved order, amount and currency before marking success", async () => {
  const ctx = setup(), original = globalThis.fetch;
  let result;
  globalThis.fetch = async (url) => url.endsWith("/init.json")
    ? new Response(`{"initResult":{"resultCode":0,"txnId":${transactionId},"redirectUrl":"https://airtime.codapayments.com/airtime/begin"}}`)
    : Response.json({ paymentResult: result });
  try {
    await create(ctx);
    delete ctx.env.CODAPAY_CHECKOUT_ENABLED;
    result = { resultCode: 481 };
    assert.equal((await (await status(ctx)).json()).status, "pending");
    result = { resultCode: 0, txnId: transactionId, orderId: ctx.saved.orderId, originAmount: 20, originCurrency: "USD" };
    assert.equal((await (await status(ctx)).json()).status, "success");
    assert.equal(ctx.saved.raw.items[0].quantity, "2");
    result.originAmount = 1;
    assert.equal((await status(ctx)).status, 500);
    assert.equal(ctx.saved.status, "success");
    result = { resultCode: null };
    assert.equal((await status(ctx)).status, 500);
  } finally { globalThis.fetch = original; }
});
test("Codapay rejects forged notifications and checks the provider before acknowledgement", async () => {
  const ctx = setup(), original = globalThis.fetch;
  globalThis.fetch = async (url) => url.endsWith("/init.json")
    ? new Response(`{"initResult":{"resultCode":0,"txnId":${transactionId},"redirectUrl":"https://airtime.codapayments.com/airtime/begin"}}`)
    : Response.json({ paymentResult: { resultCode: 0, txnId: transactionId, orderId: ctx.saved.orderId, originAmount: 20, originCurrency: "USD" } });
  try {
    await create(ctx);
    delete ctx.env.CODAPAY_CHECKOUT_ENABLED;
    const params = new URLSearchParams({ TxnId: transactionId, OrderId: ctx.saved.orderId, ResultCode: "0", Checksum: "0".repeat(32) });
    let response = await worker.fetch(new Request(`https://pay.example/api/codapay/transaction-notification?${params}`), ctx.env);
    assert.equal(response.status, 401);
    params.set("Checksum", md5(`${transactionId}${secret}${ctx.saved.orderId}0`));
    response = await worker.fetch(new Request(`https://pay.example/api/codapay/transaction-notification?${params}`), ctx.env);
    assert.equal(await response.text(), "ResultCode=0");
    assert.equal(ctx.saved.status, "success");
  } finally { globalThis.fetch = original; }
});
