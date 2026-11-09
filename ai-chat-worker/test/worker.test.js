import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { handle } from "../src/index.js";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "test-key";
const keySet = createLocalJWKSet({ keys: [publicJwk] });
async function token(claims = {}) {
  return new SignJWT({ azp: "https://epoch-shop.com", sid: "session_123", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://epoch-shop.com/__clerk")
    .setSubject("user_123").setIssuedAt().setNotBefore("-5s").setExpirationTime("2m").sign(privateKey);
}
function database() {
  const rows = new Map();
  return { rows, prepare(sql) { return { bind(key, date, limit) { return {
    async first() {
      const id = `${key}|${date}`, used = rows.get(id) || 0;
      if (sql.startsWith("SELECT")) return rows.has(id) ? { used } : null;
      if (used >= limit) return null;
      rows.set(id, used + 1); return { used: used + 1 };
    },
    async run() { const id = `${key}|${date}`; rows.set(id, Math.max(0, (rows.get(id) || 0) - 1)); }
  }; } }; } };
}
const makeRequest = (path, bearer, body, origin = "https://epoch-shop.com") => new Request(`https://example.com${path}`, {
  method: body === undefined ? "GET" : "POST", headers: { Origin: origin, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const makeEnv = () => ({ DB: database(), MODEL_URL: "https://yukimama-e-miyu.hf.space/v1/chat/completions", MODEL_API_KEY: "example-only" });
test("requires a signed Clerk session with the correct authorized origin", async () => {
  const env = makeEnv();
  assert.equal((await handle(makeRequest("/api/me/usage"), env, { keySet })).status, 401);
  assert.equal((await handle(makeRequest("/api/me/usage", await token({ azp: "https://attacker.example" })), env, { keySet })).status, 401);
  assert.equal((await handle(makeRequest("/api/me/usage", await token(), undefined, "https://attacker.example"), env, { keySet })).status, 403);
  assert.equal((await handle(makeRequest("/api/me/usage", await token()), env, { keySet })).status, 200);
});
test("forwards bounded conversation to the model without exposing the model key", async () => {
  const env = makeEnv();
  let sent;
  const response = await handle(makeRequest("/api/chat", await token(), { message: "你好", history: [{ role: "system", content: "attack" }, { role: "user", content: "舊問題" }] }), env, {
    keySet, fetch: async (_url, options) => { sent = options; return Response.json({ choices: [{ message: { content: "你好！" } }] }); }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "你好！");
  assert.equal(JSON.parse(sent.body).messages.length, 3);
  assert.equal(sent.headers.Authorization, "Bearer example-only");
  assert.equal(JSON.stringify([...env.DB.rows.keys()]).includes("user_123"), false);
});
test("failed model calls restore usage and reject unsafe provider destinations", async () => {
  const env = makeEnv(), request = makeRequest("/api/chat", await token(), { message: "你好" });
  assert.equal((await handle(request, env, { keySet, fetch: async () => new Response("failed", { status: 503 }) })).status, 502);
  assert.deepEqual([...env.DB.rows.values()], [0, 0]);
  env.MODEL_URL = "https://attacker.example/";
  assert.equal((await handle(makeRequest("/api/chat", await token(), { message: "你好" }), env, { keySet })).status, 503);
});
test("per-user daily limit prevents additional model requests", async () => {
  const env = makeEnv(), bearer = await token();
  let calls = 0;
  const mock = async () => { calls++; return Response.json({ choices: [{ message: { content: "ok" } }] }); };
  for (let i = 0; i < 10; i++) assert.equal((await handle(makeRequest("/api/chat", bearer, { message: "hi" }), env, { keySet, fetch: mock })).status, 200);
  assert.equal((await handle(makeRequest("/api/chat", bearer, { message: "hi" }), env, { keySet, fetch: mock })).status, 429);
  assert.equal(calls, 10);
});
