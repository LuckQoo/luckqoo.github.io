import { createRemoteJWKSet, jwtVerify } from "jose";

const CLERK_ISSUERS = ["https://clerk.epoch-shop.com", "https://epoch-shop.com/__clerk"];
const ORIGINS = new Set(["https://epoch-shop.com", "https://www.epoch-shop.com"]);
const jwks = createRemoteJWKSet(new URL("https://clerk.epoch-shop.com/.well-known/jwks.json"));
const USER_DAILY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 50;
const MAX_MESSAGE = 4000;
const SYSTEM_PROMPT = "你是 EPOCH SHOP 的 AI 助理阿容。請使用繁體中文，以親切且誠實的方式回答；不知道的事情不要編造。";

function headers(request) {
  const result = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
  const origin = request.headers.get("Origin");
  if (ORIGINS.has(origin)) Object.assign(result, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" });
  return result;
}
function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers(request), "Content-Type": "application/json; charset=utf-8" } });
}
async function authenticate(request, keySet = jwks) {
  const bearer = request.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer ") || bearer.length > 8192) return null;
  try {
    const { payload } = await jwtVerify(bearer.slice(7), keySet, { algorithms: ["RS256"], issuer: CLERK_ISSUERS, requiredClaims: ["exp", "nbf", "iat", "sub", "sid"] });
    if (!ORIGINS.has(payload.azp) || typeof payload.sub !== "string" || !payload.sub || typeof payload.sid !== "string" || !payload.sid) return null;
    return payload.sub;
  } catch { return null; }
}
async function userKey(userId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
function messagesFrom(input) {
  if (!input || typeof input.message !== "string") return null;
  const message = input.message.trim();
  if (!message || message.length > MAX_MESSAGE) return null;
  const history = Array.isArray(input.history) ? input.history.slice(-12) : [];
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const item of history) {
    if ((item?.role === "user" || item?.role === "assistant") && typeof item.content === "string" && item.content.length <= MAX_MESSAGE && item.content.trim()) messages.push({ role: item.role, content: item.content.trim() });
  }
  messages.push({ role: "user", content: message });
  return messages;
}
async function count(db, key, date) {
  const row = await db.prepare("SELECT used FROM daily_usage WHERE usage_key = ? AND usage_date = ?").bind(key, date).first();
  return Number(row?.used || 0);
}
async function increment(db, key, date, limit) {
  return db.prepare("INSERT INTO daily_usage (usage_key, usage_date, used) VALUES (?, ?, 1) ON CONFLICT(usage_key, usage_date) DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used").bind(key, date, limit).first();
}
async function decrement(db, key, date) {
  await db.prepare("UPDATE daily_usage SET used = MAX(0, used - 1) WHERE usage_key = ? AND usage_date = ?").bind(key, date).run();
}
async function handle(request, env, options = {}) {
  const origin = request.headers.get("Origin");
  if (origin && !ORIGINS.has(origin)) return json(request, { error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/healthz") return json(request, { ok: true, modelConfigured: Boolean(env.MODEL_URL && env.MODEL_API_KEY), databaseConfigured: Boolean(env.DB) });
  if (!((request.method === "POST" && path === "/api/chat") || (request.method === "GET" && path === "/api/me/usage"))) return json(request, { error: "not_found" }, 404);
  const userId = await authenticate(request, options.keySet);
  if (!userId) return json(request, { error: "unauthorized" }, 401);
  if (!env.DB) return json(request, { error: "database_not_configured" }, 503);
  const date = new Date().toISOString().slice(0, 10);
  const key = `user:${await userKey(userId)}`;
  if (path === "/api/me/usage") {
    const used = await count(env.DB, key, date);
    return json(request, { freeDuringTraining: true, unlimited: false, used, limit: USER_DAILY_LIMIT, remaining: Math.max(0, USER_DAILY_LIMIT - used) });
  }
  if (!env.MODEL_URL || !env.MODEL_API_KEY) return json(request, { error: "ai_not_configured" }, 503);
  let modelUrl;
  try { modelUrl = new URL(env.MODEL_URL); } catch { return json(request, { error: "ai_not_configured" }, 503); }
  if (modelUrl.protocol !== "https:" || !["yukimama-e-miyu.hf.space", "router.huggingface.co"].includes(modelUrl.hostname)) return json(request, { error: "ai_not_configured" }, 503);
  if (Number(request.headers.get("Content-Length")) > 60000) return json(request, { error: "request_too_large" }, 413);
  const raw = await request.text();
  if (raw.length > 60000) return json(request, { error: "request_too_large" }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json(request, { error: "invalid_request" }, 400); }
  const messages = messagesFrom(input);
  if (!messages) return json(request, { error: "invalid_message" }, 400);
  if (!await increment(env.DB, key, date, USER_DAILY_LIMIT)) return json(request, { error: "daily_limit_exceeded", limit: USER_DAILY_LIMIT }, 429);
  if (!await increment(env.DB, "global", date, GLOBAL_DAILY_LIMIT)) { await decrement(env.DB, key, date); return json(request, { error: "service_daily_limit_exceeded" }, 429); }
  try {
    const response = await (options.fetch || fetch)(modelUrl.toString(), {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MODEL_API_KEY}` },
      body: JSON.stringify({ model: env.MODEL_NAME || "epoch-shop", messages, max_tokens: 512, stream: false }), signal: AbortSignal.timeout(115000)
    });
    if (!response.ok) throw new Error(`model_http_${response.status}`);
    const result = await response.json();
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("model_empty_reply");
    return json(request, { reply: reply.trim(), searched: false });
  } catch (err) {
    await Promise.all([decrement(env.DB, key, date), decrement(env.DB, "global", date)]);
    console.error("AI inference request failed", err?.message);
    return json(request, { error: "upstream_error" }, 502);
  }
}
export { authenticate, handle, messagesFrom };
export default { fetch: handle };
