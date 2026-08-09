(function () {
  document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
    const originalText = btn.textContent;
    btn.addEventListener("click", () => {
      window.cartApi.addToCart({
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: Number(btn.dataset.price)
      });
      btn.textContent = "已加入！";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1200);
    });
  });
})();
