const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.protocol === "file:";

const CHAT_ENDPOINT =
  window.EPOCH_CHAT_ENDPOINT ||
  (isLocal
    ? "http://127.0.0.1:8787/api/chat"
    : "https://api.epoch-shop.shop/api/chat");
const CHAT_STREAM_ENDPOINT =
  window.EPOCH_CHAT_STREAM_ENDPOINT ||
  (isLocal
    ? "http://127.0.0.1:8787/api/chat-stream"
    : "https://api.epoch-shop.shop/api/chat-stream");
const CHAT_MODEL = window.EPOCH_CHAT_MODEL || "epochGPT:latest";

function getStatusEl() {
  return document.getElementById("waifu-chat-status");
}

function setStatus(online) {
  const el = getStatusEl();
  if (!el) return;
  if (online) {
    el.textContent = "Epoch 助手在線";
    el.style.color = "#7dffb5";
  } else {
    el.textContent = "Epoch 助手不在線";
    el.style.color = "#ffb0b0";
  }
}

function showWaifuBubble(text, isFinal) {
  const waifu = document.querySelector(".waifu");
  if (!waifu) return;

  let bubble = document.getElementById("waifu-head-bubble");
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.id = "waifu-head-bubble";
    bubble.className = "waifu-head-bubble";
    document.body.appendChild(bubble);
  }

  bubble.textContent = `${text}`;

  const rect = waifu.getBoundingClientRect();
  bubble.style.left = `${rect.left + rect.width * 0.5}px`;
  bubble.style.top = `${Math.max(80, rect.top - 80)}px`;

  clearTimeout(showWaifuBubble._timer);
  if (isFinal) {
    showWaifuBubble._timer = setTimeout(() => bubble.remove(), 9000);
  }
}

async function callOllama(prompt) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      message: prompt,
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama 回應失敗 (${res.status})`);
  const data = await res.json();
  return data?.reply || data?.response || "我有收到訊息，但暫時沒有內容。";
}

async function callOllamaStream(prompt, onUpdate) {
  const res = await fetch(CHAT_STREAM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/plain"
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      message: prompt,
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama 回應失敗 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onUpdate(fullText, false);
  }

  fullText += decoder.decode();
  onUpdate(fullText, true);
  return fullText;
}

async function checkOnline() {
  try {
    const url = new URL(CHAT_ENDPOINT);
    url.pathname = "/healthz";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);
    setStatus(res.ok);
  } catch {
    setStatus(false);
  }
}

function createChatbox() {
  if (document.querySelector(".waifu-chatbox")) return;

  const wrap = document.createElement("div");
  wrap.className = "waifu-chatbox";
  wrap.innerHTML = `
    <div class="waifu-chat-row">
      <input id="waifu-chat-input" type="text" placeholder="對 Epoch聊天助手 說點什麼，按 Enter 送出" />
    </div>
  `;
  document.body.appendChild(wrap);

  const input = document.getElementById("waifu-chat-input");
  input.addEventListener("focus", () => document.body.classList.add("chat-input-focused"));
  input.addEventListener("blur", () => document.body.classList.remove("chat-input-focused"));

  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    try {
      setStatus(true);
      showWaifuBubble("...", false);
      await callOllamaStream(text, (partial, isFinal) => {
        showWaifuBubble(partial || "…", isFinal);
      });
      setStatus(true);
    } catch (err) {
      setStatus(false);
      try {
        const reply = await callOllama(text);
        showWaifuBubble(reply, true);
        setStatus(true);
      } catch {
        showWaifuBubble("聊天助手魂跑了 有需要可致信", true);
      }
    }
  });

  showWaifuBubble("嗨，我是 Epoch聊天助手。你想聊什麼？", true);
  checkOnline();
}

window.ensureChatbox = function () {
  createChatbox();
};

const shouldAutoInit = window.CHAT_AUTO_INIT ?? false;

window.addEventListener("DOMContentLoaded", () => {
  if (shouldAutoInit) {
    createChatbox();
  }
});

window.addEventListener("resize", () => {
  const bubble = document.getElementById("waifu-head-bubble");
  if (bubble && bubble.textContent) {
    const text = bubble.textContent;
    showWaifuBubble(text, true);
  }
});
