(function () {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-status");
  if (!form || !status) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "subtitle";
    status.textContent = "發送中...";

    const surname = document.getElementById("surname").value.trim();
    const givenName = document.getElementById("given_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    const payload = new FormData();
    payload.append("name", `${surname}${givenName}`);
    payload.append("email", email);
    payload.append("message", `姓: ${surname}\n名: ${givenName}\n信箱: ${email}\n\n內容:\n${message}`);
    payload.append("_subject", "EPOCH SHOP 聯絡表單新訊息");
    payload.append("_captcha", "false");

    try {
      const res = await fetch("https://formsubmit.co/ajax/aiyu@epoch-shop.com", {
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
      if (!res.ok || data.success !== "true") {
        const msg = data.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      status.className = "subtitle status-ok";
      status.textContent = "發送成功 請注意回覆訊息 沒收到訊息請檢查垃圾郵件";
      form.reset();
    } catch (err) {
      status.className = "subtitle status-error";
      status.textContent = `AJAX 發送失敗，改用表單直送中...（${err.message}）`;
      setTimeout(() => {
        form.submit();
        status.className = "subtitle status-ok";
        status.textContent = "已改用表單直送。若仍收不到信，請先到收件箱/垃圾信找 FormSubmit 啟用信並完成驗證。";
      }, 250);
    }
  });
})();

