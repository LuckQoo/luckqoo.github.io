const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.protocol === "file:";

const CHAT_ENDPOINT =
  window.EPOCH_CHAT_ENDPOINT ||
  (isLocal
    ? "http://127.0.0.1:8787/api/chat"
    : "https://api.epoch-shop.shop/api/chat");
const CHAT_MODEL = window.EPOCH_CHAT_MODEL || "epochGPT:latest";

function showWaifuBubble(text) {
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
  showWaifuBubble._timer = setTimeout(() => bubble.remove(), 9000);
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

function createChatbox() {
  if (document.querySelector(".waifu-chatbox")) return;

  const wrap = document.createElement("div");
  wrap.className = "waifu-chatbox";
  wrap.innerHTML = `
    <div class="waifu-chat-row">
      <div style="font-size:12px;color:#b9ffcf;">目前：AI 自動回覆</div>
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
      const reply = await callOllama(text);
      showWaifuBubble(reply);
    } catch (err) {
      showWaifuBubble("聊天助手魂跑了 有需要可致信");
    }
  });

  showWaifuBubble("嗨，我是 Epoch聊天助手。你想聊什麼？");
}

window.addEventListener("DOMContentLoaded", createChatbox);
window.addEventListener("resize", () => {
  const bubble = document.getElementById("waifu-head-bubble");
  if (bubble && bubble.textContent) {
    const text = bubble.textContent;
    showWaifuBubble(text);
  }
});
