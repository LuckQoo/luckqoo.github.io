(function () {
  const yearNode = document.getElementById("year");
  if (yearNode) yearNode.textContent = new Date().getFullYear();
})();

(function () {
  const body = document.body;
  if (!body) return;

  const createToggle = () => {
    if (document.getElementById("assistant-toggle")) return;
    const btn = document.createElement("button");
    btn.id = "assistant-toggle";
    btn.className = "assistant-toggle";
    btn.type = "button";
    btn.textContent = "開啟客服";
    body.appendChild(btn);

    const updateLabel = (open) => {
      btn.textContent = open ? "隱藏客服" : "開啟客服";
    };

    const closeAssistant = () => {
      body.classList.remove("assistant-open");
      updateLabel(false);
      const bubble = document.getElementById("waifu-head-bubble");
      if (bubble) bubble.remove();
    };

    const openAssistant = () => {
      body.classList.add("assistant-open");
      updateLabel(true);
      if (typeof window.ensureChatbox === "function") {
        window.ensureChatbox();
      }
    };

    btn.addEventListener("click", () => {
      const willOpen = !body.classList.contains("assistant-open");
      if (willOpen) {
        openAssistant();
      } else {
        closeAssistant();
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    createToggle();
  });
})();
