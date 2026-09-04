(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const txnId = params.get("TxnId") || params.get("txn_id") || "";
  const orderId = params.get("OrderId") || params.get("order_id") || "";

  const txnNode = document.querySelector("[data-codapay-txn]");
  const orderNode = document.querySelector("[data-codapay-order]");
  if (txnNode) txnNode.textContent = txnId || "未提供";
  if (orderNode) orderNode.textContent = orderId || "未提供";

  const statusNode = document.querySelector("[data-codapay-status]");
  if (!txnId || !orderId || !statusNode) return;
  fetch("https://api.epoch-shop.shop/api/codapay/payment-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txnId, orderId })
  }).then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) throw new Error(data.error || "status_unavailable");
      if (data.status === "success") {
        statusNode.textContent = "付款成功，訂單已確認。";
        if (window.cartApi) window.cartApi.clearCart();
      } else if (data.status === "pending") {
        statusNode.textContent = "付款仍在處理中，請稍後再查詢。";
      } else {
        statusNode.textContent = "付款未完成或已失敗，未收取成功款項。";
      }
    }).catch(() => { statusNode.textContent = "暫時無法查詢最終狀態，請保留交易編號並聯絡客服。"; });
})();
