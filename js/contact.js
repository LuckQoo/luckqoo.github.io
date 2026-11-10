(function () {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-status");
  if (!form || !status) return;
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "subtitle";
    status.textContent = "發送中...";
    submitButton.disabled = true;

    const fullName = document.getElementById("contact-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();
    const subject = document.getElementById("subject").value.trim();

    const payload = new FormData();
    payload.append("name", fullName);
    payload.append("email", email);
    payload.append("message", `姓名: ${fullName}\n信箱: ${email}\n主旨: ${subject}\n\n內容:\n${message}`);
    payload.append("_subject", "EPOCH SHOP 聯絡表單新訊息");
    payload.append("_captcha", "false");

    try {
      const res = await fetch("https://formsubmit.co/ajax/yukine@diary-city.com", {
        method: "POST",
        body: payload,
        headers: { Accept: "application/json" }
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok || (data.success !== "true" && data.success !== true)) {
        const msg = data.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      status.className = "subtitle status-ok";
      status.textContent = "訊息已送出，我們會盡快回覆您。";
      form.reset();
    } catch (err) {
      status.className = "subtitle status-error";
      status.textContent = "訊息未能送出，請稍後再試，或直接寄信至 yukine@diary-city.com。";
    } finally {
      submitButton.disabled = false;
    }
  });
})();

