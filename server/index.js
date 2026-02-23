import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 8787;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "epochGPT:latest";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://epoch-shop.shop";

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

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: message,
        stream: false
      })
    });

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      return res.status(502).json({ error: "ollama_failed", details: text.slice(0, 500) });
    }

    const data = await ollamaRes.json();
    return res.json({ reply: data?.response || "" });
  } catch (err) {
    return res.status(502).json({ error: "ollama_unreachable", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ollama backend listening on :${PORT}`);
});
