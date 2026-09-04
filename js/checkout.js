(function () {
  "use strict";
  const API_BASE = "https://api.epoch-shop.shop";
  const cart = window.cartApi ? window.cartApi.getCart() : [];
  const consent = document.getElementById("policy-consent");
  const messageEl = document.getElementById("payment-message");
  const summary = document.getElementById("checkout-cart-summary");
  const form = document.getElementById("payment-form");
  const fieldsContainer = document.getElementById("paypal-card-fields");
  const submit = document.getElementById("submit");
  if (!consent || !messageEl || !summary || !form || !fieldsContainer || !submit) return;
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
  async function renderCardFields() {
    const cardFields = window.paypal.CardFields({
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
      onError: (error) => { messageEl.textContent = `PayPal 付款失敗：${error.message || "請稍後再試"}`; }
    });
    if (!cardFields.isEligible()) {
      messageEl.textContent = "此商家帳戶目前尚未啟用 PayPal 信用卡／簽帳卡進階付款，請聯絡商家。";
      return;
    }
    await Promise.all([
      cardFields.NameField().render("#card-name-field-container"),
      cardFields.NumberField().render("#card-number-field-container"),
      cardFields.ExpiryField().render("#card-expiry-field-container"),
      cardFields.CVVField().render("#card-cvv-field-container")
    ]);
    fieldsContainer.hidden = false;
    submit.disabled = !consent.checked;
    consent.addEventListener("change", () => { submit.disabled = !consent.checked; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!consent.checked) {
        messageEl.textContent = "請先閱讀並同意購買政策。";
        return;
      }
      submit.disabled = true;
      messageEl.textContent = "正在安全處理卡片付款…";
      try {
        await cardFields.submit();
      } catch (error) {
        messageEl.textContent = `卡片付款失敗：${error.message || "請檢查資料後再試"}`;
        submit.disabled = false;
      }
    });
    messageEl.textContent = "請輸入信用卡或簽帳卡資料；本頁不提供 PayPal 帳戶付款。";
  }
  async function initPayPal() {
    renderSummary();
    if (!cart.length) return;
    try {
      const config = await request("/api/config");
      if (!config.paypalClientId) throw new Error("PayPal 尚未完成商家設定。請稍後再試。");
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=USD&intent=capture&components=card-fields`;
      script.onload = renderCardFields;
      script.onerror = () => { messageEl.textContent = "無法載入 PayPal 安全付款元件。"; };
      document.head.appendChild(script);
    } catch (error) {
      messageEl.textContent = error.message;
    }
  }
  initPayPal();
})();
