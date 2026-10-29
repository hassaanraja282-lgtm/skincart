// SkinCart front end
const $ = (id) => document.getElementById(id);
const state = { sessionId: null, report: null, photo: null, cart: JSON.parse(localStorage.getItem('sc_cart') || '[]'), stream: null };

function show(step) {
  document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
  $(`step-${step}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400);
}
const ICON = { Cleanse: 'C', Treat: 'T', Eyes: 'E', Moisturise: 'M', Protect: 'SPF' };
const money = (n) => `$${n.toFixed(2)}`;

// ---------- status ----------
fetch('/api/status').then((r) => r.json()).then((s) => {
  $('mode').textContent = s.live ? '● Live YouCam API' : '● Demo mode';
}).catch(() => {});

// ---------- camera ----------
$('camBtn').onclick = async () => {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
    const v = $('video'); v.srcObject = state.stream; await v.play();
    $('camPh').style.display = 'none'; $('camOverlay').style.display = 'flex'; $('shutter').hidden = false;
  } catch (e) {
    toast('Camera unavailable. Upload a photo instead.');
  }
};
$('shutter').onclick = () => {
  const v = $('video'); const c = $('canvas');
  const w = v.videoWidth, h = v.videoHeight;
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, w, h);
  stopCam();
  analyze(downscale(c));
};
function stopCam() {
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null; $('shutter').hidden = true; $('camOverlay').style.display = 'none'; $('camPh').style.display = '';
}

// ---------- upload ----------
$('fileIn').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); analyze(downscale(c)); };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
};
$('sampleBtn').onclick = () => analyze(null, true);

function downscale(src, max = 1440) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

// ---------- analyze ----------
async function analyze(dataUrl, sample = false) {
  $('scanImg').src = dataUrl || '/demo/selfie.jpg';
  show('loading');
  const steps = ['l1', 'l2', 'l3', 'l4']; steps.forEach((s) => $(s).className = '');
  let i = 0; $(steps[0]).className = 'doing';
  const tick = setInterval(() => { if (i < 3) { $(steps[i]).className = 'done'; i++; $(steps[i]).className = 'doing'; } }, sample ? 600 : 4000);
  try {
    const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample ? { sample: true } : { image: dataUrl }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Analysis failed');
    clearInterval(tick); steps.forEach((s) => $(s).className = 'done');
    state.sessionId = data.sessionId; state.report = data.report; state.photo = data.photo || dataUrl;
    await new Promise((res) => setTimeout(res, 400));
    renderReport();
    show('report');
  } catch (e) {
    clearInterval(tick); show('selfie'); toast(e.message);
  }
}

// ---------- report ----------
function renderReport() {
  const R = state.report;
  $('photo').src = state.photo; $('hl').classList.remove('on');
  $('overall').textContent = R.overall;
  requestAnimationFrame(() => { $('ringFg').style.strokeDashoffset = 326.7 * (1 - R.overall / 100); });
  $('skinAge').textContent = R.skinAge ?? '–';
  $('undertone').textContent = R.tone.undertone; $('depth').textContent = R.tone.depth;
  $('utLabel').textContent = R.tone.undertone;
  $('toneChips').innerHTML = [
    ['Skin', R.tone.skin], R.tone.eyeHex && [`Eyes · ${R.tone.eye}`, R.tone.eyeHex], R.tone.hairHex && [`Hair · ${R.tone.hair}`, R.tone.hairHex], R.tone.lip && ['Natural lip', R.tone.lip],
  ].filter(Boolean).map(([l, c]) => `<span class="chip"><i class="dot" style="background:${c}"></i>${l}</span>`).join('');

  $('concerns').innerHTML = R.concerns.map((c) => `
    <div class="concern" data-k="${c.key}" title="${c.tip}">
      <span>${c.label}</span><div class="bar"><i style="background:var(--${c.severity === 'unknown' ? 'muted' : c.severity})" data-w="${c.score}"></i></div>
      <span class="num">${c.score}</span><span class="tag ${c.severity}">${c.severity === 'focus' ? 'Focus' : c.severity === 'mild' ? 'Mild' : 'Good'}</span>
    </div>`).join('');
  requestAnimationFrame(() => document.querySelectorAll('.concern .bar i').forEach((b) => b.style.width = b.dataset.w + '%'));
  document.querySelectorAll('.concern').forEach((el) => el.onclick = () => selectConcern(el.dataset.k));
  const first = R.concerns[0]; if (first) setTimeout(() => selectConcern(first.key), 900);

  $('routine').innerHTML = R.routine.map((p) => productCard(p)).join('');
  bindAdds();

  const F = R.foundation.best;
  $('shadeCard').innerHTML = `
    <div class="step-l" style="color:var(--accent);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Foundation match</div>
    <div class="sw-big"><div class="sw-pair"><div style="background:${R.tone.skin}" title="Your skin"></div><div style="background:${F.shade}" title="${F.name}"></div></div>
    <div><div class="match">${F.match}%<small> match</small></div><b>${F.name}</b></div></div>
    <p class="fine">Measured skin colour ${R.tone.skin} · ${R.tone.depth}, ${R.tone.undertone} undertone. Matched by colour distance (CIE ΔE) across 16 shades.</p>
    <div class="alts">${R.foundation.alternates.map((a) => `<span class="chip"><i class="dot" style="background:${a.shade}"></i>${a.name.replace('Skin Tint ', '')}</span>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="try" data-try="${F.id}">Try it on</button>${addBtn({ ...F })}</div>`;

  $('lips').innerHTML = R.lips.map((l) => `
    <div class="swatch"><i class="dot" style="background:${l.shade}"></i><div class="info"><b>${l.name.replace('Satin Lip ', '')}</b><span>Satin lip · ${money(l.price)}</span></div>
    <div class="btns"><button class="try" data-try="${l.id}">Try on</button>${addBtn(l)}</div></div>`).join('');
  bindAdds();
  document.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => tryOn(b.dataset.try));

  $('baBefore').src = state.photo; $('baAfter').src = state.photo; setBa(50);
  $('tryNote').textContent = 'Pick a shade to try it on your own face.';
}

function selectConcern(k) {
  const c = state.report.concerns.find((x) => x.key === k); if (!c) return;
  document.querySelectorAll('.concern').forEach((el) => el.classList.toggle('sel', el.dataset.k === k));
  if (c.mask) highlight(c.mask);
  $('photoCap').innerHTML = `<b>${c.label}: ${c.score}/100.</b> ${c.tip}`;
}

// Paint where the AI's mask overlay differs from the original photo.
const imgCache = {};
const prox = (u) => (u.startsWith('/') ? u : `/api/img?u=${encodeURIComponent(u)}`);
function loadImg(u) {
  if (!imgCache[u]) imgCache[u] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = prox(u); });
  return imgCache[u];
}
async function highlight(maskUrl) {
  const cv = $('hl'); const token = (highlight.t = (highlight.t || 0) + 1);
  try {
    const base = state.report.baseImage || state.photo;
    const [a, b] = await Promise.all([loadImg(base), loadImg(maskUrl)]);
    if (token !== highlight.t) return;
    const w = 360, h = Math.round((w * b.naturalHeight) / b.naturalWidth);
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h; const x1 = c1.getContext('2d'); x1.drawImage(a, 0, 0, w, h);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const x2 = c2.getContext('2d'); x2.drawImage(b, 0, 0, w, h);
    const d1 = x1.getImageData(0, 0, w, h).data, d2 = x2.getImageData(0, 0, w, h).data;
    cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); const out = ctx.createImageData(w, h);
    for (let i = 0; i < d1.length; i += 4) {
      const diff = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]);
      const t = Math.min(1, Math.max(0, (diff - 14) / 50));
      out.data[i] = 255; out.data[i + 1] = 40; out.data[i + 2] = 120; out.data[i + 3] = Math.round(t * 210);
    }
    ctx.putImageData(out, 0, 0); cv.classList.add('on');
  } catch (e) { cv.classList.remove('on'); }
}

// ---------- products / cart ----------
const allProducts = () => {
  const R = state.report; if (!R) return [];
  return [...R.routine, R.foundation.best, ...R.lips];
};
function productCard(p) {
  return `<div class="card"><div class="em ic ic-${p.step}">${ICON[p.step] || '•'}</div><span class="step-l">${p.step}</span><h4>${p.name}</h4><p>${p.desc || ''}</p>
    <span class="why">${p.why}</span><div class="row"><span class="price">${money(p.price)}</span>${addBtn(p)}</div></div>`;
}
function addBtn(p) {
  const inCart = state.cart.some((c) => c.id === p.id);
  return `<button class="add ${inCart ? 'in' : ''}" data-add="${p.id}">${inCart ? '✓ Added' : '+ Add'}</button>`;
}
function bindAdds() {
  document.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => toggleCart(b.dataset.add));
}
function toggleCart(id) {
  const i = state.cart.findIndex((c) => c.id === id);
  if (i >= 0) { state.cart.splice(i, 1); }
  else {
    const p = allProducts().find((x) => x.id === id); if (!p) return;
    state.cart.push({ id: p.id, name: p.name, price: p.price, step: p.step, shade: p.shade || null });
    toast(`Added ${p.name}`);
  }
  saveCart();
}
function saveCart() {
  localStorage.setItem('sc_cart', JSON.stringify(state.cart));
  $('cartCount').textContent = state.cart.length;
  document.querySelectorAll('[data-add]').forEach((b) => { const on = state.cart.some((c) => c.id === b.dataset.add); b.classList.toggle('in', on); b.textContent = on ? '✓ Added' : '+ Add'; });
  renderCart();
}
function renderCart() {
  const items = state.cart;
  $('cartItems').innerHTML = items.length ? items.map((c) => `<div class="ci"><div class="em ${c.shade ? '' : 'ic ic-' + c.step}" ${c.shade ? `style="background:${c.shade}"` : ''}>${c.shade ? '' : (ICON[c.step] || '')}</div><div class="n">${c.name}<small>${c.step}</small></div><b>${money(c.price)}</b><button data-rm="${c.id}">✕</button></div>`).join('') : '<p class="empty">Your cart is empty.</p>';
  document.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => toggleCart(b.dataset.rm));
  const sub = items.reduce((s, c) => s + c.price, 0);
  const save = items.length >= 3 ? sub * 0.1 : 0;
  $('subtotal').textContent = money(sub); $('saving').textContent = `–${money(save)}`; $('total').textContent = money(sub - save);
  $('checkout').disabled = !items.length;
}
$('addRoutine').onclick = () => {
  state.report.routine.forEach((p) => { if (!state.cart.some((c) => c.id === p.id)) state.cart.push({ id: p.id, name: p.name, price: p.price, step: p.step }); });
  saveCart(); toast('Full routine added'); openCart();
};
const openCart = () => { $('drawer').classList.add('open'); $('scrim').classList.add('on'); };
const closeCart = () => { $('drawer').classList.remove('open'); $('scrim').classList.remove('on'); };
$('cartBtn').onclick = openCart; $('closeCart').onclick = closeCart; $('scrim').onclick = closeCart;
$('checkout').onclick = () => {
  const n = state.cart.length; state.cart = []; saveCart(); closeCart();
  toast(`Order placed (demo): ${n} item${n > 1 ? 's' : ''} on the way!`);
};

// ---------- try-on ----------
function setBa(v) { $('baAfterWrap').style.clipPath = `inset(0 0 0 ${v}%)`; $('ba').style.setProperty('--x', v + '%'); $('baRange').value = v; }
$('baRange').oninput = (e) => setBa(e.target.value);
async function tryOn(productId) {
  const p = allProducts().find((x) => x.id === productId);
  $('baLoading').hidden = false; $('ba').scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const r = await fetch('/api/tryon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, productId }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    await new Promise((res) => { const im = $('baAfter'); im.onload = res; im.onerror = res; im.src = d.url; });
    setBa(50);
    $('tryNote').innerHTML = `Trying <b>${p ? p.name : 'shade'}</b>. Drag to compare.${d.demo ? ' <i>(demo render)</i>' : ''}`;
  } catch (e) { toast(e.message); }
  finally { $('baLoading').hidden = true; }
}

$('againBtn').onclick = () => show('selfie');
saveCart();
