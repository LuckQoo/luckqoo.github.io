(function () {
  "use strict";

  // 建立 PayPal Business Payment Link 後，將完整連結填入此處。
  const PAYPAL_PAYMENT_LINK = "";
  const cart = window.cartApi ? window.cartApi.getCart() : [];
  const form = document.getElementById("payment-form");
  const consent = document.getElementById("policy-consent");
  const submitBtn = document.getElementById("submit");
  const messageEl = document.getElementById("payment-message");
  const summary = document.getElementById("checkout-cart-summary");

  if (!form || !consent || !submitBtn || !messageEl || !summary) return;

  function renderSummary() {
    if (!cart.length) {
      summary.innerHTML = '<p class="subtitle">購物車目前沒有商品，請先返回商品頁選購。</p>';
      messageEl.textContent = "無法建立空白訂單。";
      return;
    }

    const rows = cart.map((item) => {
      const suffix = item.recurring ? "/月" : "";
      return `<div class="cart-row"><div>${item.name} × ${item.qty}</div><div>$${item.price * item.qty}${suffix}</div></div>`;
    }).join("");
    summary.innerHTML = `${rows}<p class="price">總計：$${window.cartApi.cartTotal()}</p>`;
  }

  function updateButton() {
    submitBtn.disabled = !cart.length || !consent.checked || !PAYPAL_PAYMENT_LINK;
    if (!PAYPAL_PAYMENT_LINK) {
      messageEl.textContent = "PayPal 安全付款連結設定中，完成後即可付款。";
    } else if (!consent.checked) {
      messageEl.textContent = "請先閱讀並同意相關政策。";
    } else {
      messageEl.textContent = "您將前往 PayPal 完成安全付款。";
    }
  }

  consent.addEventListener("change", updateButton);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitBtn.disabled) return;
    window.location.assign(PAYPAL_PAYMENT_LINK);
  });

  renderSummary();
  updateButton();
})();
