(function () {
  const API_BASE = "https://api.epoch-shop.shop";

  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");
  const detailsTable = document.getElementById("details-table");
  const intentLabel = document.getElementById("intent-label");
  const intentId = document.getElementById("intent-id");
  const sessionStatusEl = document.getElementById("session-status");
  const intentStatusRow = document.getElementById("intent-status-row");
  const intentStatusLabel = document.getElementById("intent-status-label");
  const intentStatus = document.getElementById("intent-status");
  const viewDetails = document.getElementById("view-details");

  function setErrorState() {
    statusIcon.classList.add("status-error");
    statusText.textContent = "找不到結帳紀錄，請重新確認付款狀態。";
    detailsTable.classList.add("hidden");
    viewDetails.classList.add("hidden");
  }

  function setSessionDetails(session) {
    if (!session || !session.status) {
      setErrorState();
      return;
    }

    if (session.status === "complete") {
      statusIcon.classList.add("status-ok");
      statusText.textContent = "付款成功，感謝您的購買！";
    } else {
      statusIcon.classList.add("status-error");
      statusText.textContent = "付款未完成，請重新嘗試。";
    }

    sessionStatusEl.textContent = session.payment_status || session.status;

    if (session.payment_intent_id) {
      intentLabel.textContent = "Payment Intent ID";
      intentId.textContent = session.payment_intent_id;
      intentStatusLabel.textContent = "Payment Intent 狀態";
      intentStatus.textContent = session.payment_intent_status || "-";
      viewDetails.href = `https://dashboard.stripe.com/payments/${session.payment_intent_id}`;
    } else if (session.subscription_id) {
      intentLabel.textContent = "Subscription ID";
      intentId.textContent = session.subscription_id;
      intentStatusLabel.textContent = "訂閱狀態";
      intentStatus.textContent = session.subscription_status || "-";
      viewDetails.href = `https://dashboard.stripe.com/subscriptions/${session.subscription_id}`;
    } else {
      intentStatusRow.classList.add("hidden");
      viewDetails.classList.add("hidden");
    }
  }

  async function initialize() {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setErrorState();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`);
      const session = await res.json();
      setSessionDetails(session);
    } catch {
      setErrorState();
    }
  }

  initialize();
})();
