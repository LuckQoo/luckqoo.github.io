import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import { URL } from "url";

const app = express();

const PORT = process.env.PORT || 8787;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "epochGPT:latest";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()),
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    maxAge: 86400
  })
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

function postJson(urlString, payload) {
  const url = new URL(urlString);
  const data = JSON.stringify(payload);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search || ""}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 0, body });
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getPrompt(body) {
  const safeBody = body && typeof body === "object" ? body : {};
  const raw = typeof safeBody.message === "string" ? safeBody.message : safeBody.prompt;
  return typeof raw === "string" ? raw.trim() : "";
}

app.post("/api/chat", async (req, res) => {
  const message = getPrompt(req.body);
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const result = await postJson(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: message,
      stream: false
    });

    if (result.statusCode < 200 || result.statusCode >= 300) {
      return res
        .status(502)
        .json({ error: "ollama_failed", details: result.body.slice(0, 500) });
    }

    let data = {};
    try {
      data = JSON.parse(result.body || "{}");
    } catch {
      data = {};
    }
    const reply = data && typeof data === "object" ? data.response : "";
    return res.json({ reply: reply || "" });
  } catch (err) {
    return res.status(502).json({ error: "ollama_unreachable", details: err.message });
  }
});

app.post("/api/generate", async (req, res) => {
  const message = getPrompt(req.body);
  if (!message) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const result = await postJson(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: message,
      stream: false
    });

    if (result.statusCode < 200 || result.statusCode >= 300) {
      return res
        .status(502)
        .json({ error: "ollama_failed", details: result.body.slice(0, 500) });
    }

    let data = {};
    try {
      data = JSON.parse(result.body || "{}");
    } catch {
      data = {};
    }
    const response = data && typeof data === "object" ? data.response : "";
    return res.json({ response: response || "" });
  } catch (err) {
    return res.status(502).json({ error: "ollama_unreachable", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ollama backend listening on :${PORT}`);
});
