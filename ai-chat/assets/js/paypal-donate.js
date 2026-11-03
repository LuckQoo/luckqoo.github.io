(function () {
	"use strict";
	// PayPal checkout is served by the dedicated Worker; the AI/chat API remains
	// on window.EPOCH_API_BASE_URL and is intentionally kept separate.
	const API_BASE = "https://api.epoch-shop.shop";
	const amountInput = document.getElementById("paypal-donation-amount");
	const fieldsContainer = document.getElementById("paypal-card-fields");
	const submit = document.getElementById("paypal-card-submit");
	const message = document.getElementById("paypal-message");
	if (!amountInput || !fieldsContainer || !submit || !message) return;

	async function request(path, options) {
		const response = await fetch(`${API_BASE}${path}`, options);
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.details || data.error || "付款服務發生錯誤");
		return data;
	}

	async function renderCardFields() {
		const cardFields = window.paypal.CardFields({
			createOrder: async () => {
				const amount = Number(amountInput.value);
				if (!Number.isFinite(amount) || amount < 5 || amount > 1000) throw new Error("請輸入 US$5–1,000 的贊助金額。");
				message.textContent = "正在建立安全訂單…";
				const order = await request("/api/paypal/donations/orders", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ amount }),
				});
				return order.id;
			},
			onApprove: async (data) => {
				message.textContent = "正在確認付款…";
				const capture = await request(`/api/paypal/donations/orders/${encodeURIComponent(data.orderID)}/capture`, { method: "POST" });
				message.textContent = capture.status === "COMPLETED" ? `謝謝您的支持！PayPal 訂單：${capture.id}` : "付款尚未完成，請稍後查詢 PayPal。";
			},
			onError: (error) => { message.textContent = `PayPal 付款失敗：${error.message || "請稍後再試"}`; },
		});
		if (!cardFields.isEligible()) {
			message.textContent = "此商家帳戶目前尚未啟用 PayPal 信用卡／簽帳卡進階付款。";
			return;
		}
		await Promise.all([
			cardFields.NameField().render("#donation-card-name"),
			cardFields.NumberField().render("#donation-card-number"),
			cardFields.ExpiryField().render("#donation-card-expiry"),
			cardFields.CVVField().render("#donation-card-cvv"),
		]);
		fieldsContainer.hidden = false;
		submit.disabled = false;
		submit.addEventListener("click", async () => {
			submit.disabled = true;
			message.textContent = "正在安全處理卡片付款…";
			try {
				await cardFields.submit();
			} catch (error) {
				message.textContent = `卡片付款失敗：${error.message || "請檢查資料後再試"}`;
				submit.disabled = false;
			}
		});
		message.textContent = "請輸入信用卡或簽帳卡資料；本頁不提供 PayPal 帳戶付款。";
	}

	request("/api/config")
		.then((config) => {
			if (!config.paypalClientId) throw new Error("PayPal 尚未完成商家設定。請稍後再試。");
			const script = document.createElement("script");
			script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=USD&intent=capture&components=card-fields`;
			script.onload = renderCardFields;
			script.onerror = () => { message.textContent = "無法載入 PayPal 安全付款元件。"; };
			document.head.appendChild(script);
		})
		.catch((error) => { message.textContent = error.message; });
})();
