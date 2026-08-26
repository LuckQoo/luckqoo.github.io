const PRODUCTS = {
  "vehicle-model": { name: "車輛模型", amount: 11500 },
  "map-building": { name: "建築 / 地圖", amount: 13500 },
  "npc-skin": { name: "人物 / 服裝", amount: 9000 },
  "custom-code": { name: "代碼撰寫", amount: 25900 },
  "model-edit-basic": { name: "修改模型 - 基本優化", amount: 1000 },
  "model-edit-advanced": { name: "修改模型 - 進階", amount: 3000 },
  "model-edit-ultra": { name: "修改模型 - 極致", amount: 5000 },
  "hosting-e": { name: "E 系列主機當期費用", amount: 30000 },
  "hosting-n": { name: "N 系列主機當期費用", amount: 60000 }
};

const ALLOWED_ORIGINS = new Set([
  "https://epoch-shop.shop",
  "https://www.epoch-shop.shop",
  "https://epoch-shop.com",
  "https://www.epoch-shop.com"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://epoch-shop.shop",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request) }
  });
}

async function paypal(request, env, pathname, options = {}) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("paypal_not_configured");
  const base = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error("paypal_auth_failed");
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "paypal_request_failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function createShopOrder(request, env) {
  const body = await request.json().catch(() => ({}));
  const input = Array.isArray(body.items) ? body.items : [];
  if (!input.length || input.length > 30) return json(request, { error: "empty_or_large_cart" }, 400);
  let total = 0;
  const items = [];
  for (const entry of input) {
    const product = PRODUCTS[entry?.id];
    const quantity = Number(entry?.qty);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return json(request, { error: "invalid_item", details: entry?.id }, 400);
    }
    total += product.amount * quantity;
    items.push({
      name: product.name,
      quantity: String(quantity),
      unit_amount: { currency_code: "USD", value: (product.amount / 100).toFixed(2) }
    });
  }
  const value = (total / 100).toFixed(2);
  const order = await paypal(request, env, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: "epoch-shop-checkout",
        description: "EPOCH SHOP checkout",
        amount: { currency_code: "USD", value, breakdown: { item_total: { currency_code: "USD", value } } },
        items
      }],
      payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } }
    })
  });
  return json(request, { id: order.id });
}

async function createDonation(request, env) {
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents < 500 || cents > 100000 || Math.abs(cents / 100 - amount) > 1e-9) {
    return json(request, { error: "invalid_amount", details: "Amount must be between USD 5 and 1,000." }, 400);
  }
  const order = await paypal(request, env, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ custom_id: "epoch-ai-donation", description: "Support Epoch AI training", amount: { currency_code: "USD", value: (cents / 100).toFixed(2) } }],
      payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } }
    })
  });
  return json(request, { id: order.id });
}

async function captureOrder(request, env, orderId, expectedCustomId) {
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) return json(request, { error: "invalid_order_id" }, 400);
  const order = await paypal(request, env, `/v2/checkout/orders/${orderId}`, { method: "GET" });
  if (order?.purchase_units?.[0]?.custom_id !== expectedCustomId) return json(request, { error: "order_not_created_by_this_checkout" }, 400);
  const capture = await paypal(request, env, `/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() }
  });
  return json(request, { id: capture.id, status: capture.status });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && (url.pathname === "/api/config" || url.pathname === "/healthz")) {
        return json(request, url.pathname === "/healthz" ? { ok: true } : { paypalClientId: env.PAYPAL_CLIENT_ID, paypalCurrency: "USD", paypalEnvironment: env.PAYPAL_ENV || "sandbox" });
      }
      if (request.method === "POST" && url.pathname === "/api/paypal/shop/orders") return createShopOrder(request, env);
      if (request.method === "POST" && url.pathname === "/api/paypal/donations/orders") return createDonation(request, env);
      let match = url.pathname.match(/^\/api\/paypal\/orders\/([A-Z0-9]+)\/capture$/);
      if (request.method === "POST" && match) return captureOrder(request, env, match[1], "epoch-shop-checkout");
      match = url.pathname.match(/^\/api\/paypal\/donations\/orders\/([A-Z0-9]+)\/capture$/);
      if (request.method === "POST" && match) return captureOrder(request, env, match[1], "epoch-ai-donation");
      return json(request, { error: "not_found" }, 404);
    } catch (error) {
      return json(request, { error: "paypal_error", details: error.message }, error.status || 502);
    }
  }
};
