(function () {
  "use strict";

  const API_BASE = "https://api.epoch-shop.shop";
  const cart = window.cartApi ? window.cartApi.getCart() : [];
  const form = document.getElementById("payment-form");
  const messageEl = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");
  const spinner = document.getElementById("spinner");
  const buttonText = document.getElementById("button-text");
  let chargeComponent = null;
  let transactionId = "";
  let transactionOrderId = "";

  if (!form) return;

  function showMessage(text, isError) {
    messageEl.classList.remove("hidden", "success");
    if (!isError) messageEl.classList.add("success");
    messageEl.textContent = text;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.classList.toggle("hidden", !isLoading);
    buttonText.classList.toggle("hidden", isLoading);
  }

  function renderCartSummary() {
    const summary = document.getElementById("checkout-cart-summary");
    if (!summary || !cart.length) return;
    summary.innerHTML = cart.map((item) =>
      `<div class="cart-row"><div>${item.name} × ${item.qty}</div><div>$${item.price * item.qty}${item.recurring ? "/月" : ""}</div></div>`
    ).join("");
  }

  async function waitForPaymentResult() {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetch(`${API_BASE}/api/codapay/payment-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnId: transactionId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error("暫時無法確認付款狀態，請稍後再試。");
      if (data.status === "success") {
        if (window.cartApi) window.cartApi.clearCart();
        const query = new URLSearchParams({ txn_id: transactionId, order_id: transactionOrderId });
        window.location.assign(`codapay-complete.html?${query.toString()}`);
        return;
      }
      if (data.status === "failed") {
        throw new Error(data.resultDesc || "付款未完成，請檢查資料後再試。");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    showMessage("付款仍在處理中，請勿重複付款；稍後可憑交易編號向我們查詢。", false);
  }

  async function initialize() {
    if (!cart.length) {
      showMessage("購物車是空的，請先到服務項目頁面選購。", true);
      return;
    }
    if (cart.some((item) => item.recurring)) {
      showMessage("安全付款服務尚未支援此網站的自動月繳主機方案，請先移除主機方案或聯絡我們。", true);
      return;
    }
    renderCartSummary();

    try {
      const response = await fetch(`${API_BASE}/api/codapay/create-component-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((item) => ({ id: item.id, qty: item.qty })) })
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          response.status === 404
            ? "安全付款後端 API 尚未部署（HTTP 404）。"
            : `安全付款後端回應格式錯誤（HTTP ${response.status}）。`
        );
      }
      const data = await response.json();
      if (!response.ok || !data.clientSecret) {
        throw new Error(data.details || data.resultDesc || "無法建立安全付款工作階段。");
      }
      transactionId = String(data.txnId || "");
      transactionOrderId = String(data.orderId || "");
      if (typeof window.CodaCard !== "function") throw new Error("安全付款元件載入失敗。");

      const components = window.CodaCard().components({
        clientSecret: data.clientSecret,
        appearance: { customStyle: { borderRadius: "8px" } }
      });
      chargeComponent = components.create("charge", {
        withCardHolderName: true,
        withCardHolderEmail: true,
        locale: "en"
      });

      chargeComponent.on("userLoaded", function () {
        showMessage("安全付款欄位已載入。", false);
      });
      chargeComponent.on("readyStateChange", function (isReady) {
        submitBtn.disabled = !isReady;
        if (isReady) showMessage("付款資料格式正確，可以送出。", false);
      });
      chargeComponent.on("processingCard", function (isSuccess, errorMessage) {
        submitBtn.disabled = true;
        if (isSuccess) {
          showMessage("付款已送出，正在等待付款伺服器確認。", false);
          waitForPaymentResult().catch(function (error) {
            showMessage(error.message || "暫時無法確認付款狀態。", true);
            submitBtn.disabled = false;
          });
        } else {
          showMessage(errorMessage || "付款失敗，請檢查資料後再試。", true);
          submitBtn.disabled = false;
        }
      });
      chargeComponent.on("shopperActionRequired", function (required) {
        if (required) showMessage("請在安全視窗完成 3D Secure 驗證。", false);
      });
      chargeComponent.on("shopperActionCompleted", function () {
        showMessage("3D Secure 驗證完成，正在等待付款結果。", false);
      });

      chargeComponent.mount("#payment-element");
      buttonText.textContent = `支付 $${Number(data.amount).toFixed(2)} ${data.currency}`;
    } catch (error) {
      const paymentElement = document.getElementById("payment-element");
      if (paymentElement) {
        paymentElement.textContent = "安全付款服務尚未完成後端部署，請稍後再試。";
      }
      showMessage(error.message || "無法載入付款頁面。", true);
      submitBtn.disabled = true;
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!chargeComponent) return;
    setLoading(true);
    showMessage("正在安全處理付款…", false);
    chargeComponent.submit();
  });

  initialize();
})();
