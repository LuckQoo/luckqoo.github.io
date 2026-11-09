(function () {
  const filters = document.querySelectorAll('[data-category-filter]');
  const products = document.querySelectorAll('[data-category]');
  filters.forEach((filter) => filter.addEventListener('click', () => {
    const selected = filter.dataset.categoryFilter;
    filters.forEach((button) => {
      const active = button === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    products.forEach((product) => { product.hidden = selected !== 'all' && product.dataset.category !== selected; });
  }));
})();
