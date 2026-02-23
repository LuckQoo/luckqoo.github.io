const CART_KEY = "epoch_shop_cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();
  const found = cart.find((p) => p.id === item.id);
  if (found) {
    found.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart(cart);
}

function removeFromCart(id) {
  saveCart(getCart().filter((item) => item.id !== id));
}

function clearCart() {
  saveCart([]);
}

function updateCartCount() {
  const total = getCart().reduce((sum, item) => sum + item.qty, 0);
  const node = document.querySelector("[data-cart-count]");
  if (node) node.textContent = String(total);
}

function cartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

window.cartApi = { getCart, addToCart, removeFromCart, clearCart, cartTotal, updateCartCount };
window.addEventListener("DOMContentLoaded", updateCartCount);
