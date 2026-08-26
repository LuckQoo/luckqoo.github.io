(function () {
  "use strict";
  const API_BASE = "https://api.epoch-shop.shop";
  const cart = window.cartApi ? window.cartApi.getCart() : [];
  const consent = document.getElementById("policy-consent");
  const messageEl = document.getElementById("payment-message");
  const summary = document.getElementById("checkout-cart-summary");
  const container = document.getElementById("paypal-button-container");
  if (!consent || !messageEl || !summary || !container) return;
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
  function renderButtons() {
    window.paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "paypal" },
      onClick: (_data, actions) => {
        if (!consent.checked) {
          messageEl.textContent = "請先閱讀並同意購買政策。";
          return actions.reject();
        }
        return actions.resolve();
      },
      createOrder: async () => {
        messageEl.textContent = "正在建立安全訂單…";
        const order = await request("/api/paypal/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map(({ id, qty }) => ({ id, qty })) }) });
        return order.id;
      },
      onApprove: async (data) => {
        messageEl.textContent = "正在確認付款…";
        const capture = await request(`/api/paypal/orders/${encodeURIComponent(data.orderID)}/capture`, { method: "POST" });
        if (capture.status !== "COMPLETED") throw new Error("PayPal 尚未完成付款，請稍後查詢訂單狀態。");
        if (window.cartApi) window.cartApi.clearCart();
        window.location.assign(`complete.html?paypal_order_id=${encodeURIComponent(capture.id)}`);
      },
      onCancel: () => { messageEl.textContent = "付款已取消，購物車內容仍為您保留。"; },
      onError: (error) => { messageEl.textContent = `PayPal 付款失敗：${error.message || "請稍後再試"}`; }
    }).render(container);
    messageEl.textContent = "勾選同意政策後，即可使用 PayPal 安全結帳。";
  }
  async function initPayPal() {
    renderSummary();
    if (!cart.length) return;
    try {
      const config = await request("/api/config");
      if (!config.paypalClientId) throw new Error("PayPal 尚未完成商家設定。請稍後再試。");
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=USD&intent=capture&components=buttons`;
      script.onload = renderButtons;
      script.onerror = () => { messageEl.textContent = "無法載入 PayPal 安全付款元件。"; };
      document.head.appendChild(script);
    } catch (error) {
      messageEl.textContent = error.message;
    }
  }
  initPayPal();
})();
