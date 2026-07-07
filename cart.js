/* Carrito simple (localStorage), compartido entre la galería del gauchito y la pasarela de pago. */
const CART_KEY = "jp_cart";

function cartGet() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (e) { return []; }
}
function cartSave(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}
function cartAdd(src) {
  const items = cartGet();
  const found = items.find((it) => it.src === src);
  if (found) found.qty++;
  else items.push({ src, qty: 1 });
  cartSave(items);
  return items;
}
function cartInc(src) {
  const items = cartGet();
  const found = items.find((it) => it.src === src);
  if (found) found.qty++;
  cartSave(items);
  return items;
}
function cartDec(src) {
  let items = cartGet();
  const found = items.find((it) => it.src === src);
  if (found) {
    found.qty--;
    if (found.qty <= 0) items = items.filter((it) => it.src !== src);
  }
  cartSave(items);
  return items;
}
function cartRemove(src) {
  const items = cartGet().filter((it) => it.src !== src);
  cartSave(items);
  return items;
}
function cartTotal(items) {
  return items.reduce((sum, it) => sum + it.qty, 0);
}
