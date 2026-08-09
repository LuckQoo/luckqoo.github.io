(function () {
  const yearNode = document.getElementById("year");
  if (yearNode) yearNode.textContent = new Date().getFullYear();

  // Personal Stripe test-mode toggle: visit any page once with ?dev=<token>
  // and it's remembered on this browser (localStorage) for future page loads.
  const DEV_TOKEN_KEY = "epoch_dev_token";
  const devParam = new URLSearchParams(window.location.search).get("dev");
  if (devParam) {
    localStorage.setItem(DEV_TOKEN_KEY, devParam);
  }
  window.getDevToken = function () {
    return localStorage.getItem(DEV_TOKEN_KEY) || "";
  };
})();
