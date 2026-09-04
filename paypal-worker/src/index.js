import md5 from "js-md5";

const PRODUCTS = {
  "vehicle-model": { name: "車輛模型", amount: 11500 }, "map-building": { name: "建築 / 地圖", amount: 13500 },
  "npc-skin": { name: "人物 / 服裝", amount: 9000 }, "custom-code": { name: "代碼撰寫", amount: 25900 },
  "model-edit-basic": { name: "修改模型 - 基本優化", amount: 1000 }, "model-edit-advanced": { name: "修改模型 - 進階", amount: 3000 },
  "model-edit-ultra": { name: "修改模型 - 極致", amount: 5000 }, "hosting-e": { name: "E 系列主機使用權", amount: 30000 },
  "hosting-n": { name: "N 系列主機使用權", amount: 60000 }
};
const ALLOWED_ORIGINS = new Set(["https://epoch-shop.shop", "https://www.epoch-shop.shop", "https://epoch-shop.com", "https://www.epoch-shop.com"]);
const EVENT_STATUS = new Map([
  ["PAYMENT.CAPTURE.COMPLETED", "COMPLETED"], ["PAYMENT.CAPTURE.PENDING", "PENDING"],
  ["PAYMENT.CAPTURE.DECLINED", "DENIED"], ["PAYMENT.CAPTURE.DENIED", "DENIED"],
  ["PAYMENT.CAPTURE.REFUNDED", "REFUNDED"], ["PAYMENT.CAPTURE.REVERSED", "REVERSED"],
  ["CHECKOUT.PAYMENT-APPROVAL.REVERSED", "APPROVAL_REVERSED"], ["CUSTOMER.DISPUTE.CREATED", "DISPUTED"]
]);

function responseHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "86400", Vary: "Origin", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(request, data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...responseHeaders(request) } }); }

async function paypal(env, pathname, options = {}) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("paypal_not_configured");
  const base = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) throw new Error("paypal_auth_failed");
  const response = await fetch(`${base}${pathname}`, { ...options, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || "paypal_request_failed"); error.status = response.status; throw error; }
  return data;
}

export function buildShopPurchase(input) {
  if (!Array.isArray(input) || !input.length || input.length > 30) return { error: "empty_or_large_cart" };
  let total = 0; const items = [];
  for (const entry of input) {
    const product = PRODUCTS[entry?.id]; const quantity = Number(entry?.qty);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { error: "invalid_item", details: entry?.id };
    total += product.amount * quantity;
    items.push({ name: product.name, quantity: String(quantity), unit_amount: { currency_code: "USD", value: (product.amount / 100).toFixed(2) } });
  }
  return { cents: total, value: (total / 100).toFixed(2), items };
}
export function validateDonation(value) {
  const amount = Number(value); const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents < 500 || cents > 100000 || Math.abs(cents / 100 - amount) > 1e-9) return { error: "invalid_amount", details: "Amount must be between USD 5 and 1,000 with no fractions of a cent." };
  return { cents, value: (cents / 100).toFixed(2) };
}
export function isValidOrderId(value) { return /^[A-Z0-9]{10,30}$/.test(value || ""); }

const CODAPAY_BASE_URL = "https://airtime.codapayments.com/airtime/api/restful/v2.0/Payment";
const CODAPAY_COUNTRY_TAIWAN = 158;
const CODAPAY_CURRENCY_USD = 840;
const CODAPAY_RETURN_URL = "https://epoch-shop.shop/menu/codapay-complete.html?txn_id={transactionId}&order_id={orderId}";

function isEmail(value) { return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function parseCodapay(raw) { return JSON.parse(raw.replace(/("txnId"\s*:\s*)(\d{16,})/g, '$1"$2"')); }
function codapayStatus(resultCode) { return resultCode === 0 ? "success" : resultCode === 431 || resultCode === 216 ? "pending" : "failed"; }

async function codapayRequest(env, endpoint, payload) {
  if (env.CODAPAY_ENV !== "production" || !env.CODAPAY_API_KEY || !env.CODAPAY_PROJECT_ID) throw new Error("codapay_not_configured");
  const response = await fetch(`${CODAPAY_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  let data;
  try { data = parseCodapay(raw); } catch { throw new Error("codapay_invalid_response"); }
  if (!response.ok) throw new Error("codapay_upstream_error");
  return data;
}

async function createCodapayPayment(request, env) {
  const body = await request.json().catch(() => ({}));
  const purchase = buildShopPurchase(body.items);
  if (purchase.error) return json(request, purchase, 400);
  if (body.items.some((entry) => entry?.id === "hosting-e" || entry?.id === "hosting-n")) {
    return json(request, { error: "recurring_not_supported", details: "Codapay 目前不支援此訂閱方案，請聯絡客服。" }, 400);
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!isEmail(email)) return json(request, { error: "invalid_email" }, 400);

  const items = [];
  for (const entry of body.items) {
    const product = PRODUCTS[entry.id];
    for (let index = 0; index < Number(entry.qty); index += 1) {
      items.push({ code: entry.id, price: product.amount / 100, name: product.name.replace(/[^\x20-\x7E]/g, "").trim() || entry.id });
    }
  }
  const orderId = `epoch-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const data = await codapayRequest(env, "init.json", {
    initRequest: {
      country: CODAPAY_COUNTRY_TAIWAN,
      payType: 0,
      apiKey: env.CODAPAY_API_KEY,
      projectId: Number(env.CODAPAY_PROJECT_ID),
      orderId,
      currency: CODAPAY_CURRENCY_USD,
      items,
      profile: { entry: [
        { key: "user_id", value: email },
        { key: "email", value: email },
        { key: "lang_code", value: "zh_TW" },
        { key: "return_url", value: CODAPAY_RETURN_URL }
      ] }
    }
  });
  const result = data?.initResult;
  const txnId = String(result?.txnId || "");
  let redirect;
  try { redirect = new URL(result?.redirectUrl || ""); } catch { redirect = null; }
  if (Number(result?.resultCode) !== 0 || !/^\d{16,25}$/.test(txnId) || redirect?.protocol !== "https:" || redirect.hostname !== "airtime.codapayments.com") {
    return json(request, { error: "codapay_init_failed", resultCode: result?.resultCode, details: result?.resultDesc || "Codapay 無法建立付款。" }, 502);
  }
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO codapay_orders (txn_id,order_id,customer_email,amount_cents,currency,status,raw_json,created_at,updated_at) VALUES (?,?,?,?,?,'initiated',?,?,?)")
    .bind(txnId, orderId, email, purchase.cents, "USD", JSON.stringify(data), now, now).run();
  return json(request, { txnId, orderId, redirectUrl: redirect.toString(), environment: "production" });
}

async function inquireCodapay(env, txnId) {
  const data = await codapayRequest(env, "inquiryPaymentResult.json", {
    inquiryPaymentRequest: { apiKey: env.CODAPAY_API_KEY, country: CODAPAY_COUNTRY_TAIWAN, projectId: String(env.CODAPAY_PROJECT_ID), txnId, needStatusFinal: "true" }
  });
  const result = data?.paymentResult;
  const resultCode = Number(result?.resultCode);
  if (!Number.isFinite(resultCode)) throw new Error("codapay_status_unavailable");
  return { data, result, resultCode, status: codapayStatus(resultCode) };
}

async function getCodapayStatus(request, env) {
  const body = await request.json().catch(() => ({}));
  const txnId = String(body.txnId || "");
  const orderId = String(body.orderId || "");
  if (!/^\d{16,25}$/.test(txnId) || !/^epoch-[a-zA-Z0-9-]{8,50}$/.test(orderId)) return json(request, { error: "invalid_transaction" }, 400);
  const saved = await env.DB.prepare("SELECT order_id FROM codapay_orders WHERE txn_id=?").bind(txnId).first();
  if (!saved || saved.order_id !== orderId) return json(request, { error: "unknown_transaction" }, 404);
  const inquiry = await inquireCodapay(env, txnId);
  await env.DB.prepare("UPDATE codapay_orders SET status=?,result_code=?,raw_json=?,updated_at=? WHERE txn_id=?")
    .bind(inquiry.status, inquiry.resultCode, JSON.stringify(inquiry.data), new Date().toISOString(), txnId).run();
  return json(request, { txnId, orderId, status: inquiry.status, resultCode: inquiry.resultCode, resultDesc: inquiry.result?.resultDesc || "" });
}

async function handleCodapayNotification(request, env) {
  const url = new URL(request.url);
  const txnId = url.searchParams.get("TxnId") || "";
  const orderId = url.searchParams.get("OrderId") || "";
  const resultCode = url.searchParams.get("ResultCode") || "";
  const checksum = url.searchParams.get("Checksum") || "";
  const expected = md5(`${txnId}${env.CODAPAY_API_KEY || ""}${orderId}${resultCode}`);
  if (!/^[a-f\d]{32}$/i.test(checksum) || checksum.toLowerCase() !== expected.toLowerCase()) return new Response("ResultCode=401", { status: 401 });
  const saved = await env.DB.prepare("SELECT order_id FROM codapay_orders WHERE txn_id=?").bind(txnId).first();
  if (!saved || saved.order_id !== orderId) return new Response("ResultCode=404", { status: 404 });
  const inquiry = await inquireCodapay(env, txnId);
  await env.DB.prepare("UPDATE codapay_orders SET status=?,result_code=?,raw_json=?,updated_at=? WHERE txn_id=?")
    .bind(inquiry.status, inquiry.resultCode, JSON.stringify(inquiry.data), new Date().toISOString(), txnId).run();
  return new Response("ResultCode=0", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function allowedByRateLimit(request, env) {
  const now = Date.now(); const windowStart = Math.floor(now / 60000) * 60000;
  const key = `${request.headers.get("CF-Connecting-IP") || "unknown"}:${windowStart}`;
  await env.DB.prepare("INSERT INTO rate_limits (bucket_key,request_count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET request_count=request_count+1").bind(key, windowStart + 120000).run();
  const row = await env.DB.prepare("SELECT request_count FROM rate_limits WHERE bucket_key=?").bind(key).first();
  return Number(row?.request_count || 0) <= 20;
}
async function saveOrder(env, order, kind, customId, cents, requestId) {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO paypal_orders (order_id,kind,custom_id,amount_cents,currency,status,create_request_id,raw_json,created_at,updated_at) VALUES (?,?,?,?,'USD',?,?,?,?,?)")
    .bind(order.id, kind, customId, cents, order.status || "CREATED", requestId, JSON.stringify(order), now, now).run();
}
async function createOrder(request, env, kind) {
  const body = await request.json().catch(() => ({}));
  const details = kind === "shop" ? buildShopPurchase(body.items) : validateDonation(body.amount);
  if (details.error) return json(request, details, 400);
  const customId = kind === "shop" ? "epoch-shop-checkout" : "epoch-ai-donation";
  const requestId = crypto.randomUUID();
  const unit = kind === "shop"
    ? { custom_id: customId, description: "EPOCH SHOP checkout", amount: { currency_code: "USD", value: details.value, breakdown: { item_total: { currency_code: "USD", value: details.value } } }, items: details.items }
    : { custom_id: customId, description: "Support Epoch AI training", amount: { currency_code: "USD", value: details.value } };
  const order = await paypal(env, "/v2/checkout/orders", { method: "POST", headers: { "PayPal-Request-Id": requestId }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [unit] }) });
  await saveOrder(env, order, kind, customId, details.cents, requestId);
  return json(request, { id: order.id });
}
async function captureOrder(request, env, orderId, expectedCustomId) {
  if (!isValidOrderId(orderId)) return json(request, { error: "invalid_order_id" }, 400);
  const saved = await env.DB.prepare("SELECT * FROM paypal_orders WHERE order_id=?").bind(orderId).first();
  if (!saved || saved.custom_id !== expectedCustomId) return json(request, { error: "order_not_created_by_this_checkout" }, 400);
  if (saved.status === "COMPLETED" && saved.capture_id) return json(request, { id: saved.order_id, captureId: saved.capture_id, status: "COMPLETED", duplicate: true });
  const order = await paypal(env, `/v2/checkout/orders/${orderId}`, { method: "GET" }); const unit = order?.purchase_units?.[0];
  if (unit?.custom_id !== expectedCustomId || unit?.amount?.currency_code !== saved.currency || Math.round(Number(unit?.amount?.value) * 100) !== saved.amount_cents) return json(request, { error: "order_integrity_check_failed" }, 400);
  const capture = await paypal(env, `/v2/checkout/orders/${orderId}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `capture-${orderId}` } });
  const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
  await env.DB.prepare("UPDATE paypal_orders SET status=?,capture_id=COALESCE(?,capture_id),raw_json=?,updated_at=? WHERE order_id=?").bind(capture.status, captureId, JSON.stringify(capture), new Date().toISOString(), orderId).run();
  return json(request, { id: capture.id, captureId, status: capture.status });
}

async function verifyWebhook(request, env, event) {
  if (!env.PAYPAL_WEBHOOK_ID) throw new Error("paypal_webhook_not_configured");
  const fields = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];
  if (fields.some(name => !request.headers.get(name))) return false;
  const result = await paypal(env, "/v1/notifications/verify-webhook-signature", { method: "POST", body: JSON.stringify({ auth_algo: request.headers.get("paypal-auth-algo"), cert_url: request.headers.get("paypal-cert-url"), transmission_id: request.headers.get("paypal-transmission-id"), transmission_sig: request.headers.get("paypal-transmission-sig"), transmission_time: request.headers.get("paypal-transmission-time"), webhook_id: env.PAYPAL_WEBHOOK_ID, webhook_event: event }) });
  return result.verification_status === "SUCCESS";
}
function relatedOrderId(event) { return event?.resource?.supplementary_data?.related_ids?.order_id || event?.resource?.disputed_transactions?.[0]?.seller_transaction_id || null; }
async function processWebhook(env, event) {
  const status = EVENT_STATUS.get(event.event_type); if (!status) return;
  const relatedId = relatedOrderId(event); if (!relatedId) return;
  await env.DB.prepare("UPDATE paypal_orders SET status=?,capture_id=COALESCE(capture_id,?),raw_json=?,updated_at=? WHERE order_id=? OR capture_id=?")
    .bind(status, event?.resource?.id || null, JSON.stringify(event), new Date().toISOString(), relatedId, relatedId).run();
}
async function handleWebhook(request, env) {
  const event = await request.json().catch(() => null);
  if (!event?.id || !event?.event_type) return json(request, { error: "invalid_webhook" }, 400);
  if (!(await verifyWebhook(request, env, event))) return json(request, { error: "invalid_webhook_signature" }, 400);
  const existing = await env.DB.prepare("SELECT processing_status FROM paypal_webhook_events WHERE event_id=?").bind(event.id).first();
  if (existing?.processing_status === "PROCESSED" || existing?.processing_status === "PROCESSING") return json(request, { received: true, duplicate: true });
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO paypal_webhook_events (event_id,event_type,processing_status,raw_json,received_at) VALUES (?,?,'PROCESSING',?,?) ON CONFLICT(event_id) DO UPDATE SET processing_status='PROCESSING',raw_json=excluded.raw_json,error_message=NULL").bind(event.id, event.event_type, JSON.stringify(event), now).run();
  try {
    await processWebhook(env, event);
    await env.DB.prepare("UPDATE paypal_webhook_events SET processing_status='PROCESSED',processed_at=? WHERE event_id=?").bind(new Date().toISOString(), event.id).run();
  } catch (error) {
    await env.DB.prepare("UPDATE paypal_webhook_events SET processing_status='FAILED',error_message=? WHERE event_id=?").bind(String(error?.message || error), event.id).run();
    throw error;
  }
  return json(request, { received: true });
}

export default { async fetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  const path = new URL(request.url).pathname;
  try {
    if (request.method === "GET" && path === "/api/codapay/transaction-notification") return handleCodapayNotification(request, env);
    if (request.method === "POST" && path === "/api/codapay/payments") { if (!(await allowedByRateLimit(request, env))) return json(request, { error: "rate_limit_exceeded" }, 429); return createCodapayPayment(request, env); }
    if (request.method === "POST" && path === "/api/codapay/payment-status") return getCodapayStatus(request, env);
    if (request.method === "POST" && path === "/api/paypal/webhook") return handleWebhook(request, env);
    if (request.method === "GET" && path === "/healthz") { await env.DB.prepare("SELECT 1").first(); return json(request, { ok: true, database: true, webhookConfigured: Boolean(env.PAYPAL_WEBHOOK_ID) }); }
    if (request.method === "GET" && path === "/api/config") return json(request, { paypalClientId: env.PAYPAL_CLIENT_ID, paypalCurrency: "USD", paypalEnvironment: env.PAYPAL_ENV || "sandbox" });
    if (request.method === "POST" && (path === "/api/paypal/shop/orders" || path === "/api/paypal/donations/orders")) { if (!(await allowedByRateLimit(request, env))) return json(request, { error: "rate_limit_exceeded" }, 429); return createOrder(request, env, path.includes("/shop/") ? "shop" : "donation"); }
    let match = path.match(/^\/api\/paypal\/orders\/([A-Z0-9]+)\/capture$/); if (request.method === "POST" && match) return captureOrder(request, env, match[1], "epoch-shop-checkout");
    match = path.match(/^\/api\/paypal\/donations\/orders\/([A-Z0-9]+)\/capture$/); if (request.method === "POST" && match) return captureOrder(request, env, match[1], "epoch-ai-donation");
    return json(request, { error: "not_found" }, 404);
  } catch (error) { console.error("paypal worker error", error); return json(request, { error: "paypal_error", details: error.message }, error.status || 500); }
} };
