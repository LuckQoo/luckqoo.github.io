(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const txnId = params.get("TxnId") || "未提供";
  const orderId = params.get("OrderId") || "未提供";

  const txnNode = document.querySelector("[data-codapay-txn]");
  const orderNode = document.querySelector("[data-codapay-order]");
  if (txnNode) txnNode.textContent = txnId;
  if (orderNode) orderNode.textContent = orderId;
})();
