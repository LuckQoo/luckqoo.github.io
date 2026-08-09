(function () {
  const API_BASE = "https://api.epoch-shop.shop";

  function apiUrl(path) {
    const devToken = window.getDevToken ? window.getDevToken() : "";
    const sep = path.includes("?") ? "&" : "?";
    return devToken ? `${API_BASE}${path}${sep}dev=${encodeURIComponent(devToken)}` : `${API_BASE}${path}`;
  }

  const cart = window.cartApi ? window.cartApi.getCart() : [];

  const form = document.getElementById("payment-form");
  const messageEl = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");
  const spinner = document.getElementById("spinner");
  const buttonText = document.getElementById("button-text");

  if (!form) return;

  let actions = null;

  function showMessage(text) {
    messageEl.classList.remove("hidden");
    messageEl.textContent = text;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.classList.toggle("hidden", !isLoading);
    buttonText.classList.toggle("hidden", isLoading);
  }

  function renderCartSummary() {
    const el = document.getElementById("checkout-cart-summary");
    if (!el || !cart.length) return;
    el.innerHTML = cart
      .map((item) => `<div class="cart-row"><div>${item.name} x ${item.qty}</div><div>$${item.price * item.qty}${item.recurring ? "/月" : ""}</div></div>`)
      .join("");
  }

  async function initialize() {
    if (!cart.length) {
      showMessage("購物車是空的，請先到服務項目頁面選購。");
      submitBtn.disabled = true;
      return;
    }
    if (window.cartApi && window.cartApi.hasMixedCart()) {
      showMessage("購物車裡同時有一次性商品和訂閱制主機，請回購物車移除其中一種再結帳。");
      submitBtn.disabled = true;
      return;
    }
    renderCartSummary();

    let publishableKey;
    try {
      const configRes = await fetch(apiUrl("/api/config"));
      ({ publishableKey } = await configRes.json());
    } catch {
      showMessage("無法連線到伺服器，請稍後再試。");
      submitBtn.disabled = true;
      return;
    }
    if (!publishableKey) {
      showMessage("尚未設定 Stripe 金鑰，請聯絡我們。");
      submitBtn.disabled = true;
      return;
    }

    const stripe = Stripe(publishableKey);

    const clientSecretPromise = fetch(apiUrl("/api/shop/create-checkout-session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map((item) => ({ id: item.id, qty: item.qty })) })
    })
      .then((r) => r.json())
      .then((r) => {
        if (!r.clientSecret) throw new Error(r.error || "建立結帳失敗");
        return r.clientSecret;
      });

    const appearance = {
      theme: "night",
      variables: {
        colorBackground: "#111115",
        colorPrimary: "#30313D",
        colorText: "#62FE74",
        fontFamily: "DM Sans, system-ui, sans-serif",
        fontSizeBase: "1rem",
        fontWeightNormal: "400",
        borderRadius: "5px"
      }
    };

    const checkout = stripe.initCheckoutElementsSdk({
      clientSecret: clientSecretPromise,
      elementsOptions: { appearance }
    });

    checkout.on("change", (session) => {
      submitBtn.disabled = !session.canConfirm;
    });

    const loadActionsResult = await checkout.loadActions();
    if (loadActionsResult.type !== "success") {
      showMessage("無法載入結帳資訊，請重新整理頁面。");
      submitBtn.disabled = true;
      return;
    }
    actions = loadActionsResult.actions;
    const session = actions.getSession();
    buttonText.textContent = `付款 $${session.total.total.amount}`;

    const contactDetailsElement = checkout.createContactDetailsElement();
    contactDetailsElement.mount("#contact-details-element");

    const paymentElement = checkout.createPaymentElement();
    paymentElement.mount("#payment-element");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!actions) return;
    setLoading(true);
    const result = await actions.confirm();
    if (result.type === "error") {
      showMessage(result.error.message);
      setLoading(false);
    }
    // 成功時 Stripe 會導向 return_url，不需要再手動處理
  });

  initialize();
})();
