(function () {
  "use strict";
  const API_BASE = "https://pay.epoch-shop.com";
  const consent = document.getElementById("policy-consent");
  const email = document.getElementById("customer-email");
  const summary = document.getElementById("checkout-cart-summary");
  const form = document.getElementById("payment-form");
  const submit = document.getElementById("submit");
  const message = document.getElementById("payment-message");
  if (!window.cartApi || !consent || !email || !summary || !form || !submit || !message) return;

  const cart = window.cartApi.getCart();
  if (!cart.length) {
    summary.textContent = "購物車目前是空的，請先選購商品。";
    return;
  }
  for (const item of cart) {
    const row = document.createElement("div");
    row.className = "cart-row";
    const name = document.createElement("div");
    name.textContent = `${item.name} × ${item.qty}`;
    const price = document.createElement("div");
    price.textContent = `US$${item.price * item.qty}${item.recurring ? "/月" : ""}`;
    row.append(name, price);
    summary.appendChild(row);
  }
  const total = document.createElement("p");
  total.className = "price";
  total.textContent = `總計：US$${window.cartApi.cartTotal()}`;
  summary.appendChild(total);
  if (cart.some((item) => item.recurring || item.id === "hosting-e" || item.id === "hosting-n")) {
    message.textContent = "主機月租目前無法線上結帳，請聯絡客服安排。其他商品請分開結帳。";
    return;
  }
  submit.disabled = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    message.textContent = "正在建立 Codapay 安全付款頁…";
    try {
      const response = await fetch(`${API_BASE}/api/codapay/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), items: cart.map(({ id, qty }) => ({ id, qty })) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("payment_unavailable");
      const url = new URL(data.redirectUrl);
      if (url.protocol !== "https:" || url.hostname !== "airtime.codapayments.com") throw new Error("invalid_checkout_url");
      window.location.assign(url.href);
    } catch (error) {
      console.error("[checkout] payment setup failed", error);
      message.textContent = "暫時無法建立付款頁，請稍後再試或聯絡客服。";
      submit.disabled = false;
    }
  });
})();
