const $ = s => document.querySelector(s);
const money = n => "$" + n.toFixed(2);
const STORE = "brewCounterSales";
let cart = [];
let activeCat = "All";
let size = "M";

const loadSales = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; } };
const saveSales = s => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} };

function renderFilters() {
  const cats = ["All", ...new Set(MENU.map(m => m.cat))];
  $("#filters").innerHTML = cats.map(c =>
    `<button class="chip ${c === activeCat ? "on" : ""}" data-cat="${c}">${c}</button>`).join("") +
    `<span class="sizes">Size: ${Object.keys(SIZES).map(s =>
      `<button class="chip ${s === size ? "on" : ""}" data-size="${s}">${s}</button>`).join("")}</span>`;
}
function renderMenu() {
  const items = MENU.filter(m => activeCat === "All" || m.cat === activeCat);
  $("#menuGrid").innerHTML = items.map(m => {
    const p = m.price + (m.noSize ? 0 : SIZES[size]);
    return `<button class="item" data-id="${m.id}"><span>${m.name}</span><b>${money(p)}</b></button>`;
  }).join("");
}

function addToCart(id) {
  const m = MENU.find(x => x.id === id);
  const sz = m.noSize ? "" : size;
  const price = m.price + (m.noSize ? 0 : SIZES[sz]);
  const key = id + sz;
  const line = cart.find(l => l.key === key);
  line ? line.qty++ : cart.push({ key, name: m.name, size: sz, price, qty: 1 });
  renderCart();
}
function totals() {
  const sub = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const d = Math.min(100, Math.max(0, parseFloat($("#discount").value) || 0));
  return { sub, total: sub * (1 - d / 100), d };
}
function renderCart() {
  $("#cartEmpty").style.display = cart.length ? "none" : "block";
  $("#cartList").innerHTML = cart.map(l => `
    <li><div><strong>${l.name}</strong> ${l.size ? `<small>${l.size}</small>` : ""}<br><small>${money(l.price)} each</small></div>
    <div class="qty"><button data-dec="${l.key}" aria-label="Remove one">−</button><span>${l.qty}</span><button data-inc="${l.key}" aria-label="Add one">+</button></div></li>`).join("");
  const t = totals();
  $("#subtotal").textContent = money(t.sub);
  $("#total").textContent = money(t.total);
}
function changeQty(key, delta) {
  const l = cart.find(x => x.key === key);
  if (!l) return;
  l.qty += delta;
  if (l.qty <= 0) cart = cart.filter(x => x !== l);
  renderCart();
}

function completeSale() {
  if (!cart.length) return alert("Add at least one item first.");
  const t = totals();
  const sale = {
    id: Date.now(),
    time: new Date().toISOString(),
    items: cart.map(l => ({ name: l.name, size: l.size, qty: l.qty, price: l.price })),
    discount: t.d, subtotal: t.sub, total: t.total,
    payment: $("#payment").value
  };
  const sales = loadSales(); sales.push(sale); saveSales(sales);
  showReceipt(sale);
  cart = []; $("#discount").value = 0; renderCart();
}
function showReceipt(s) {
  $("#receiptPaper").innerHTML = `
    <h3>Brew Counter</h3><p class="c">${new Date(s.time).toLocaleString()}<br>Receipt #${String(s.id).slice(-6)}</p><hr>
    ${s.items.map(i => `<p class="row"><span>${i.qty} × ${i.name} ${i.size}</span><span>${money(i.price * i.qty)}</span></p>`).join("")}<hr>
    <p class="row"><span>Subtotal</span><span>${money(s.subtotal)}</span></p>
    ${s.discount ? `<p class="row"><span>Discount ${s.discount}%</span><span>−${money(s.subtotal - s.total)}</span></p>` : ""}
    <p class="row big"><span>Total</span><span>${money(s.total)}</span></p>
    <p class="c">Paid by ${s.payment}<br>Thank you!</p>`;
  $("#receipt").classList.remove("hidden");
}

function renderSales() {
  const sales = loadSales().slice().reverse();
  const today = new Date().toDateString();
  const todays = sales.filter(s => new Date(s.time).toDateString() === today);
  const sum = a => a.reduce((x, s) => x + s.total, 0);
  const counts = {};
  sales.forEach(s => s.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.qty));
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  $("#stats").innerHTML = `
    <div><span>Today</span><b>${money(sum(todays))}</b><small>${todays.length} orders</small></div>
    <div><span>All time</span><b>${money(sum(sales))}</b><small>${sales.length} orders</small></div>
    <div><span>Average order</span><b>${money(sales.length ? sum(sales) / sales.length : 0)}</b></div>
    <div><span>Best seller</span><b>${best ? best[0] : "–"}</b><small>${best ? best[1] + " sold" : ""}</small></div>`;
  $("#salesEmpty").style.display = sales.length ? "none" : "block";
  $("#salesBody").innerHTML = sales.map(s => `<tr>
    <td>${new Date(s.time).toLocaleString()}</td>
    <td>${s.items.map(i => `${i.qty}× ${i.name}${i.size ? " (" + i.size + ")" : ""}`).join(", ")}</td>
    <td>${s.payment}</td><td class="r">${money(s.total)}</td></tr>`).join("");
}
function exportCsv() {
  const rows = [["Time", "Items", "Payment", "Discount %", "Total"]];
  loadSales().forEach(s => rows.push([s.time, s.items.map(i => `${i.qty}x ${i.name} ${i.size}`).join("; "), s.payment, s.discount, s.total.toFixed(2)]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "coffee-sales.csv"; a.click();
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.cat) { activeCat = t.dataset.cat; renderFilters(); renderMenu(); }
  else if (t.dataset.size) { size = t.dataset.size; renderFilters(); renderMenu(); }
  else if (t.dataset.id) addToCart(+t.dataset.id);
  else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
  else if (t.dataset.view) {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === t));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("hidden", v.id !== t.dataset.view));
    if (t.dataset.view === "sales") renderSales();
  }
});
$("#discount").addEventListener("input", renderCart);
$("#clearBtn").onclick = () => { cart = []; renderCart(); };
$("#payBtn").onclick = completeSale;
$("#closeReceipt").onclick = () => $("#receipt").classList.add("hidden");
$("#printBtn").onclick = () => window.print();
$("#csvBtn").onclick = exportCsv;
$("#resetBtn").onclick = () => { if (confirm("Delete all recorded sales? This cannot be undone.")) { saveSales([]); renderSales(); } };

renderFilters(); renderMenu(); renderCart();
