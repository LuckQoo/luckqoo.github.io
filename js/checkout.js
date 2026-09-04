(function () {
  "use strict";
  const API_BASE = "https://api.epoch-shop.shop";
  const cart = window.cartApi ? window.cartApi.getCart() : [];
  const consent = document.getElementById("policy-consent");
  const messageEl = document.getElementById("payment-message");
  const summary = document.getElementById("checkout-cart-summary");
  const form = document.getElementById("payment-form");
  const submit = document.getElementById("submit");
  const email = document.getElementById("customer-email");
  if (!consent || !messageEl || !summary || !form || !submit || !email) return;
  function renderSummary() {
    if (!cart.length) {
      summary.innerHTML = '<p class="subtitle">購物車目前是空的，請先選購商品。</p>';
      messageEl.textContent = "沒有可結帳的商品。";
      return;
    }
    const rows = cart.map((item) => `<div class="cart-row"><div>${item.name} × ${item.qty}</div><div>$${item.price * item.qty}${item.recurring ? "/月" : ""}</div></div>`).join("");
    summary.innerHTML = `${rows}<p class="price">總計：$${window.cartApi.cartTotal()}</p>`;
  }
  async function request(path, options) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.details || data.error || "付款服務發生錯誤");
    return data;
  }
  async function initCodapay() {
    renderSummary();
    if (!cart.length) return;
    const updateButton = () => { submit.disabled = !consent.checked || !email.validity.valid; };
    consent.addEventListener("change", updateButton);
    email.addEventListener("input", updateButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!consent.checked || !email.validity.valid) return updateButton();
      submit.disabled = true;
      messageEl.textContent = "正在建立 Codapay 安全付款頁…";
      try {
        const payment = await request("/api/codapay/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value.trim(), items: cart.map(({ id, qty }) => ({ id, qty })) })
        });
        if (!/^https:\/\/airtime\.codapayments\.com\//.test(payment.redirectUrl || "")) {
          throw new Error("付款服務傳回了無效網址。");
        }
        window.location.assign(payment.redirectUrl);
      } catch (error) {
        messageEl.textContent = `Codapay 付款建立失敗：${error.message || "請稍後再試"}`;
        updateButton();
      }
    });
    messageEl.textContent = "";
    updateButton();
  }
  initCodapay();
})();
