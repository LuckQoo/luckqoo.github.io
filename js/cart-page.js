(function () {
  const list = document.getElementById('cart-list');
  const images = {
    'vehicle-model': 'reference-vehicle.png', 'map-building': 'reference-castle.png',
    'npc-skin': 'reference-character.png', 'custom-code': 'reference-code.png',
    'model-edit-basic': 'reference-model.png', 'model-edit-advanced': 'reference-model.png',
    'model-edit-ultra': 'reference-model.png', 'hosting-e': 'reference-host-e.png',
    'hosting-n': 'reference-host-n.png'
  };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function render() {
    const items = window.cartApi.getCart();
    list.replaceChildren();
    if (!items.length) list.append(element('p', 'empty-cart', '目前購物車沒有商品，快去探索喜歡的商品吧。'));
    items.forEach((item) => {
      const row = element('article', 'reference-cart-row');
      const product = element('div', 'reference-cart-product');
      const img = element('img', 'cart-product-image');
      img.src = '../css/images/' + (images[item.id] || 'reference-model.png');
      img.alt = '';
      const details = element('div', 'cart-product-details');
      details.append(element('h3', '', item.name), element('p', '', `US$${item.price}${item.recurring ? '/月' : ''}`));
      product.append(img, details);
      const quantity = element('div', 'quantity-control');
      const minus = element('button', '', '−'); minus.type = 'button'; minus.setAttribute('aria-label', `減少${item.name}數量`);
      minus.disabled = item.qty <= 1;
      minus.addEventListener('click', () => { window.cartApi.setQuantity(item.id, item.qty - 1); render(); });
      const count = element('span', '', String(item.qty));
      const plus = element('button', '', '+'); plus.type = 'button'; plus.setAttribute('aria-label', `增加${item.name}數量`);
      plus.addEventListener('click', () => { window.cartApi.setQuantity(item.id, item.qty + 1); render(); });
      quantity.append(minus, count, plus);
      const remove = element('button', 'remove-item', '♲ 移除'); remove.type = 'button';
      remove.setAttribute('aria-label', `移除${item.name}`);
      remove.addEventListener('click', () => { window.cartApi.removeFromCart(item.id); render(); });
      row.append(product, quantity, remove); list.append(row);
    });
    document.getElementById('cart-total').textContent = `US$${window.cartApi.cartTotal()}`;
    document.getElementById('cart-item-count').textContent = String(items.reduce((sum, item) => sum + item.qty, 0));
    document.getElementById('cart-mixed-warning').classList.toggle('hidden', !window.cartApi.hasMixedCart());
  }
  document.getElementById('clear-cart').addEventListener('click', () => { window.cartApi.clearCart(); render(); });
  render();
})();
