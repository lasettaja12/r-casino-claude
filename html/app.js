'use strict';

const IS_FIVEM = typeof GetParentResourceName === 'function';
const RES = IS_FIVEM ? GetParentResourceName() : 'freedom_casino';
if (!IS_FIVEM) document.documentElement.classList.add('preview');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n));
const fmtMult = m => (Math.floor(m * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + 'x';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, '0');

const RARITY = { common: '161,161,170', uncommon: '34,197,94', rare: '59,130,246', epic: '139,92,246', legendary: '217,70,239' };
const GAMES = { cases: 'Cases', coinflip: 'Coinflip', mines: 'Mines', crash: 'Crash', plinko: 'Plinko', blackjack: 'Blackjack' };
const ICON = {};
$$('.tab').forEach(t => { ICON[t.dataset.tab] = $('svg', t).outerHTML; });
const SVG = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 21 9 9M12 21l3-12"/></svg>',
  bomb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="14" r="7"/><path d="m15.5 8.5 2-2M17 4l1.5 1.5M20 5h1"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  wager: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M15.5 9.2A6 6 0 1 1 9.2 15.5"/></svg>',
  net: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="12" height="14" rx="2"/><path d="M9 3h10a2 2 0 0 1 2 2v12"/></svg>',
};

const S = {
  balance: 0, cases: [], recent: [], minBet: 100, maxBet: 10000,
  plinko: {}, crashHistory: [], crashSpeed: 0.08,
  view: 'cases', current: null, reel: false,
};

async function call(fn, data = {}) {
  try {
    if (!IS_FIVEM) return await Mock.call(fn, data);
    const r = await fetch(`https://${RES}/call`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ fn, data }),
    });
    return await r.json();
  } catch {
    return { ok: false, error: 'Connection to the server failed.' };
  }
}
function post(name, data = {}) {
  if (!IS_FIVEM) return;
  fetch(`https://${RES}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {});
}

// plinkon voitot näytetään vasta ku pallo on oikeesti pohjalla
function setBal(n) { if (typeof n === 'number') { S.balance = n; $('#bal').textContent = fmt(n - Plinko.pending); } }

let toastT;
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.innerHTML = (type === 'err' ? SVG.err : SVG.check) + `<span>${esc(msg)}</span>`;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 3200);
}

function rowClass(profit) { return profit > 0 ? 'rw' : profit < 0 ? 'rl' : 'rp'; }

function renderHist(game) {
  const el = $('#h-' + game);
  if (!el) return;
  const rows = S.recent.filter(e => e.game === game).slice(0, 12);
  el.innerHTML = rows.length
    ? rows.map(e => `<div class="row ${rowClass(e.profit)}"><span>${esc(e.title)}</span><b>${signed(e.profit)}</b></div>`).join('')
    : '<div class="none">No games yet</div>';
  fitRows(el);
}
function fitRows(el) {
  if (!el.clientHeight) return;
  const bottom = el.getBoundingClientRect().bottom;
  [...el.children].forEach(r => { r.style.visibility = r.getBoundingClientRect().bottom > bottom + 0.5 ? 'hidden' : ''; });
}
function addEntry(e) {
  if (!e) return;
  S.recent.unshift(e);
  renderHist(e.game);
}

function betBox(game) {
  return `<div class="lbl">Bet amount<span>${fmt(S.minBet)} – ${fmt(S.maxBet)}</span></div>
    <label class="field"><span class="coin sm"></span><input id="bet-${game}" inputmode="numeric" value="1000" aria-label="Bet amount"></label>
    <div class="quick">
      <button class="qb" data-q="half">1/2</button><button class="qb" data-q="double">2x</button>
      <button class="qb" data-q="min">Min</button><button class="qb" data-q="max">Max</button>
    </div>`;
}
function betInput(game) { return $('#bet-' + game); }
function readBet(game) {
  const v = parseInt(String(betInput(game).value).replace(/\D/g, ''), 10);
  if (!v || v < S.minBet || v > S.maxBet) { toast(`Bet must be between ${fmt(S.minBet)} and ${fmt(S.maxBet)}.`, 'err'); return null; }
  if (v > S.balance) { toast('Not enough coins.', 'err'); return null; }
  return v;
}
function lockSide(game, on) { $(`.side[data-game="${game}"]`).classList.toggle('locked', on); }

document.addEventListener('click', e => {
  const q = e.target.closest('.quick .qb');
  if (!q) return;
  const game = q.closest('.side').dataset.game;
  const inp = betInput(game);
  let v = parseInt(String(inp.value).replace(/\D/g, ''), 10) || S.minBet;
  const top = Math.max(S.minBet, Math.min(S.maxBet, S.balance));
  if (q.dataset.q === 'half') v = Math.floor(v / 2);
  if (q.dataset.q === 'double') v = v * 2;
  if (q.dataset.q === 'min') v = S.minBet;
  if (q.dataset.q === 'max') v = top;
  inp.value = Math.max(S.minBet, Math.min(top, v));
  inp.dispatchEvent(new Event('input', { bubbles: true }));
});
document.addEventListener('input', e => {
  if (e.target.id && e.target.id.startsWith('bet-')) e.target.value = e.target.value.replace(/\D/g, '').slice(0, 7);
});

function show(view) {
  S.view = view;
  $$('.view').forEach(v => { v.hidden = v.id !== 'v-' + view; });
  const tab = view === 'case' ? 'cases' : view;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#btnHistory').classList.toggle('on', view === 'history' && Hist.filter !== 'cases');
  $('#btnInv').classList.toggle('on', view === 'history' && Hist.filter === 'cases');
  if (view === 'crash') Crash.draw();
  if (view === 'plinko') Plinko.draw();
  $$(`#v-${view} .hist`).forEach(fitRows);
}
$$('.tab').forEach(t => t.addEventListener('click', () => { if (!S.reel) show(t.dataset.tab); }));

const Cases = {
  render() {
    $('#caseGrid').innerHTML = S.cases.map(c => `
      <button class="case${c.locked ? ' locked' : ''}" data-id="${esc(c.id)}">
        ${(c.vip || c.cooldown) ? `<div class="badges">
          ${c.vip ? `<span class="badge b-vip">${SVG.lock}VIP</span>` : ''}
          ${c.cooldown ? `<span class="badge b-cd">${SVG.clock}${esc(c.cooldown)}</span>` : ''}
        </div>` : ''}
        <img class="art" src="img/case.png" alt="">
        <div class="meta"><span class="name">${esc(c.label)}</span><span class="price">${fmt(c.price)}<span class="coin sm"></span></span></div>
      </button>`).join('');
  },
  itemCard(it, extra = '') {
    return `<div class="itm ${extra}" style="--rc:${RARITY[it.rarity] || RARITY.common}">
      <img src="${esc(it.image)}" alt="" onerror="this.style.visibility='hidden'">
      <b>${esc(it.label)}</b><small><em>${esc(it.rarity)}</em>${it.chance != null && extra !== 'won' && !extra.includes('r') ? esc(it.chance) + '%' : ''}</small></div>`;
  },
  detail(c) {
    S.current = c;
    $('#cdTitle').textContent = c.label;
    $('#cdPrice').innerHTML = `${fmt(c.price)}<span class="coin sm"></span>`;
    $('#cdItems').innerHTML = c.items.map(it => this.itemCard(it)).join('');
    const btn = $('#cdOpen');
    btn.textContent = c.locked ? c.lockReason || 'Locked' : 'Open case';
    btn.disabled = !!c.locked;
    show('case');
  },
  pick(items) {
    const total = items.reduce((a, it) => a + (it.chance || 1), 0);
    let r = Math.random() * total;
    for (const it of items) { r -= it.chance || 1; if (r <= 0) return it; }
    return items[items.length - 1];
  },
  async open() {
    const c = S.current;
    if (!c || S.reel) return;
    S.reel = true;
    $('#cdOpen').disabled = true;
    const res = await call('openCase', { id: c.id });
    if (!res.ok) {
      S.reel = false;
      $('#cdOpen').disabled = false;
      return toast(res.error, 'err');
    }
    setBal(S.balance - c.price);

    const won = c.items[res.index];
    const WIN = 42;
    const list = Array.from({ length: 50 }, () => this.pick(c.items));
    list[WIN] = won;
    const strip = $('#strip');
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    strip.innerHTML = list.map(it => this.itemCard(it, 'r')).join('');
    $('#wonBox').innerHTML = '';
    $('#reelOv').hidden = false;
    strip.offsetWidth;

    const step = 100;
    const target = 10 + WIN * step + 45 - $('.rwin').clientWidth / 2 + (Math.random() - 0.5) * 70;
    strip.style.transition = 'transform 5.4s cubic-bezier(.1,.7,.12,1)';
    strip.style.transform = `translateX(${-target}px)`;
    await sleep(5500);

    strip.children[WIN].classList.add('hit');
    $('#wonBox').innerHTML = this.itemCard(won, 'won') + '<div class="ov-hint" style="margin-top:12px;text-align:center">Click anywhere to continue</div>';
    setBal(res.balance);
    addEntry(res.entry);
    toast(`You won: ${won.label}!`);
    if (res.cases) {
      S.cases = res.cases;
      this.render();
      S.current = S.cases.find(x => x.id === c.id) || c;
    }
    S.reel = false;
  },
  closeReel() {
    if (S.reel) return;
    $('#reelOv').hidden = true;
    if (S.current) this.detail(S.current);
  },
};
$('#caseGrid').addEventListener('click', e => {
  const card = e.target.closest('.case');
  if (card) Cases.detail(S.cases.find(c => c.id === card.dataset.id));
});
$('#cdBack').addEventListener('click', () => show('cases'));
$('#cdOpen').addEventListener('click', () => Cases.open());
$('#reelOv').addEventListener('click', () => Cases.closeReel());

const Coinflip = {
  busy: false, angle: 0,
  caption() {
    const v = parseInt(betInput('coinflip').value, 10) || 0;
    $('#cfCap').textContent = `${fmt(v)} · 2x`;
  },
  async play() {
    if (this.busy) return;
    const bet = readBet('coinflip');
    if (bet == null) return;
    this.busy = true;
    lockSide('coinflip', true);
    $('#cfPlay').disabled = true;
    $('#cfRes').innerHTML = '';
    const r = await call('coinflip', { bet });
    if (!r.ok) {
      this.busy = false; lockSide('coinflip', false); $('#cfPlay').disabled = false;
      return toast(r.error, 'err');
    }
    setBal(S.balance - bet);
    const from = this.angle % 360;
    const to = 1800 + (r.win ? 0 : 180);
    const coin = $('#cfCoin');
    coin.animate(
      [{ transform: `rotateY(${from}deg) scale(1)` }, { transform: `rotateY(${(from + to) / 2}deg) scale(1.08)` }, { transform: `rotateY(${to}deg) scale(1)` }],
      { duration: 1700, easing: 'cubic-bezier(.2,.6,.25,1)' });
    coin.style.transform = `rotateY(${to}deg)`;
    this.angle = to;
    await sleep(1700);
    setBal(r.balance);
    addEntry(r.entry);
    $('#cfRes').innerHTML = r.win
      ? `<strong class="g">You win</strong><span>+${fmt(bet)} coins</span>`
      : `<strong class="r">You lose</strong><span>-${fmt(bet)} coins</span>`;
    if (r.win) toast(`You won ${fmt(bet * 2)} coins!`);
    this.busy = false;
    lockSide('coinflip', false);
    $('#cfPlay').disabled = false;
  },
};
$('#cfPlay').addEventListener('click', () => Coinflip.play());

const Mines = {
  active: false, pending: false, bet: 0, revealed: 0,
  build() {
    $('#mnGrid').innerHTML = Array.from({ length: 25 }, (_, i) => `<button class="tile" data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('');
  },
  reset() {
    $$('#mnGrid .tile').forEach(t => { t.className = 'tile'; t.innerHTML = ''; });
  },
  setStats(mult, profit) {
    $('#mnMult').textContent = mult.toFixed(2) + 'x';
    $('#mnProfit').textContent = fmt(profit);
  },
  button() {
    const b = $('#mnBtn');
    if (this.active) {
      const payout = Math.floor(this.bet * this.mult);
      b.className = 'main-btn green';
      b.textContent = `Cash out · ${fmt(payout)}`;
      b.disabled = this.revealed === 0 || this.pending;
    } else {
      b.className = 'main-btn';
      b.textContent = 'Start game';
      b.disabled = false;
    }
  },
  showMines(list, hit) {
    for (const i of list) {
      const t = $(`#mnGrid .tile[data-i="${i}"]`);
      t.className = 'tile bomb' + (i === hit ? ' hitb' : '');
      t.innerHTML = SVG.bomb;
    }
  },
  async start() {
    const bet = readBet('mines');
    if (bet == null) return;
    const mines = +$('#mnRange').value;
    $('#mnBtn').disabled = true;
    const r = await call('minesStart', { bet, mines });
    if (!r.ok) { $('#mnBtn').disabled = false; return toast(r.error, 'err'); }
    setBal(r.balance);
    Object.assign(this, { active: true, bet, revealed: 0, mult: 1 });
    this.reset();
    $('#mnGrid').classList.add('live');
    lockSide('mines', true);
    this.setStats(1, 0);
    this.button();
  },
  end() {
    this.active = false;
    $('#mnGrid').classList.remove('live');
    lockSide('mines', false);
    this.button();
  },
  async reveal(tile) {
    if (!this.active || this.pending || tile.classList.contains('gem')) return;
    this.pending = true;
    tile.classList.add('pending');
    this.button();
    const r = await call('minesReveal', { tile: +tile.dataset.i });
    this.pending = false;
    tile.classList.remove('pending');
    if (!r.ok) { this.button(); return toast(r.error, 'err'); }
    if (r.mine) {
      this.showMines(r.mines, r.tile);
      setBal(r.balance);
      addEntry(r.entry);
      this.setStats(0, -this.bet);
      toast(`You hit a mine and lost ${fmt(this.bet)} coins.`, 'err');
      return this.end();
    }
    tile.className = 'tile gem';
    tile.innerHTML = SVG.gem;
    this.revealed++;
    if (r.cashed) return this.cashed(r);
    this.mult = r.multiplier;
    this.setStats(r.multiplier, r.profit);
    this.button();
  },
  async cashout() {
    if (!this.active || this.pending) return;
    $('#mnBtn').disabled = true;
    const r = await call('minesCashout');
    if (!r.ok) { this.button(); return toast(r.error, 'err'); }
    this.cashed(r);
  },
  cashed(r) {
    this.showMines(r.mines);
    $$('#mnGrid .tile.bomb').forEach(t => t.classList.add('ghost'));
    this.setStats(r.multiplier, r.profit);
    setBal(r.balance);
    addEntry(r.entry);
    toast(`Cashed out: +${fmt(r.payout)} coins`);
    this.end();
  },
};
$('#mnGrid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) Mines.reveal(t); });
$('#mnBtn').addEventListener('click', () => (Mines.active ? Mines.cashout() : Mines.start()));
$('#mnRange').addEventListener('input', e => { $('#mnCount').textContent = e.target.value; });

const Crash = {
  running: false, t0: 0, bet: 0, cashed: null, crashed: null, raf: 0,
  mAt(t) { return Math.exp(S.crashSpeed * t); },
  tAt(m) { return Math.log(m) / S.crashSpeed; },
  pills() {
    $('#crPills').innerHTML = S.crashHistory.slice(0, 8).map(p => `<span class="pill ${p >= 2 ? 'g' : 'r'}">${Number(p).toFixed(2)}x</span>`).join('');
  },
  button() {
    const b = $('#crBtn');
    if (this.running && !this.cashed && !this.crashed) {
      b.className = 'main-btn green';
      b.textContent = `Cash out · ${(Math.floor(this.mAt(this.elapsed()) * 100) / 100).toFixed(2)}x`;
      b.disabled = false;
    } else {
      b.className = 'main-btn';
      b.innerHTML = this.running ? 'Waiting for round…' : `${SVG.rocket}Place bet`;
      b.disabled = this.running;
    }
  },
  elapsed() {
    if (this.crashed) return this.tAt(this.crashed);
    return this.running ? (performance.now() - this.t0) / 1000 : 0;
  },
  async place() {
    const bet = readBet('crash');
    if (bet == null) return;
    const auto = parseFloat($('#crAuto').value);
    $('#crBtn').disabled = true;
    const r = await call('crashStart', { bet, auto: auto >= 1.01 ? auto : null });
    if (!r.ok) { $('#crBtn').disabled = false; return toast(r.error, 'err'); }
    setBal(r.balance);
    Object.assign(this, { running: true, t0: performance.now(), bet, cashed: null, crashed: null });
    lockSide('crash', true);
    $('#crSub').className = '';
    $('#crSub').textContent = '';
    this.loop();
  },
  async cashout() {
    if (!this.running || this.cashed || this.crashed) return;
    $('#crBtn').disabled = true;
    const r = await call('crashCashout');
    if (!r.ok) { toast(r.error, 'err'); return; }
    this.onCashed(r);
  },
  onCashed(r) {
    if (this.cashed) return;
    this.cashed = { m: r.multiplier, t: this.tAt(r.multiplier) };
    setBal(r.balance);
    addEntry(r.entry);
    $('#crSub').className = 'g';
    $('#crSub').textContent = `Cashed out · +${fmt(r.payout)} coins`;
    this.button();
  },
  onCrashed(msg) {
    this.crashed = Math.max(1, msg.point);
    if (msg.history) { S.crashHistory = msg.history; this.pills(); }
    if (msg.entry) addEntry(msg.entry);
    if (msg.balance != null) setBal(msg.balance);
    if (!this.cashed) {
      $('#crSub').className = 'r';
      $('#crSub').textContent = `Crashed · -${fmt(this.bet)} coins`;
    }
    this.draw();
    setTimeout(() => {
      this.running = false;
      lockSide('crash', false);
      this.button();
    }, 900);
  },
  loop() {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      this.draw();
      if (this.running && !this.crashed) {
        this.button();
        this.raf = requestAnimationFrame(tick);
      }
    };
    tick();
  },
  draw() {
    const cv = $('#crCv');
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const t = this.elapsed();
    const m = this.crashed || this.mAt(t);
    const P = { l: 36, r: 18, t: 16, b: 26 };
    const xMax = Math.max(8, t * 1.1);
    const yMax = Math.max(2, 1 + (m - 1) * 1.18);
    const X = s => P.l + s / xMax * (W - P.l - P.r);
    const Y = v => H - P.b - (v - 1) / (yMax - 1) * (H - P.t - P.b);
    const nice = (raw, opts) => opts.find(o => o >= raw) || opts[opts.length - 1];

    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4a4a4a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    const ys = nice((yMax - 1) / 3, [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250]);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let v = 1 + ys; v < yMax; v += ys) {
      ctx.beginPath(); ctx.moveTo(P.l, Y(v)); ctx.lineTo(W - P.r, Y(v)); ctx.stroke();
      ctx.fillText(fmtMult(v), 6, Y(v));
    }
    const xs = nice(xMax / 4, [1, 2, 5, 10, 15, 30, 60, 120]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let s = xs; s < xMax; s += xs) {
      ctx.beginPath(); ctx.moveTo(X(s), P.t); ctx.lineTo(X(s), H - P.b); ctx.stroke();
      ctx.fillText(s + 's', X(s), H - 8);
    }

    const center = $('#crM');
    if (!this.running) {
      center.className = '';
      center.textContent = '1.00x';
      return;
    }
    center.textContent = (Math.floor(m * 100) / 100).toFixed(2) + 'x';
    center.className = this.crashed && !this.cashed ? 'r' : this.cashed ? 'g' : '';
    const col = this.crashed && !this.cashed ? '239,68,68' : this.cashed ? '52,211,153' : '147,51,234';

    const pts = [];
    const n = 90;
    for (let i = 0; i <= n; i++) { const s = t * i / n; pts.push([X(s), Y(this.mAt(s))]); }
    const grad = ctx.createLinearGradient(0, P.t, 0, H - P.b);
    grad.addColorStop(0, `rgba(${col},.32)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], H - P.b);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(pts[n][0], H - P.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = `rgb(${col})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.fillStyle = `rgb(${col})`;
    ctx.beginPath(); ctx.arc(pts[n][0], pts[n][1], 4.5, 0, Math.PI * 2); ctx.fill();

    if (this.cashed) {
      const cy = Y(this.cashed.m);
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.l, cy); ctx.lineTo(W - P.r, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#34d399';
      ctx.beginPath(); ctx.arc(X(this.cashed.t), cy, 4, 0, Math.PI * 2); ctx.fill();
    }
  },
};
$('#crBtn').addEventListener('click', () => (Crash.running ? Crash.cashout() : Crash.place()));
$('#crAuto').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d.]/g, '').slice(0, 7); });

const Plinko = {
  risk: 'high', rows: 12, balls: [], hits: {}, pending: 0, inflight: 0, raf: 0, MAX: 15,
  table() { return (S.plinko[String(this.rows)] || {})[this.risk] || []; },
  geo() {
    const cv = $('#plCv');
    const W = cv.clientWidth, H = cv.clientHeight;
    const rows = this.rows;
    const s = Math.min((W - 40) / (rows + 2), (H - 100) / rows);
    const top = Math.max(36, (H - (rows - 1) * s - 70) / 2);
    return { W, H, s, cx: W / 2, top, slotY: top + (rows - 1) * s + s * 0.85 };
  },
  slotColor(m) {
    if (m >= 20) return '239,68,68';
    if (m >= 5) return '249,115,22';
    if (m >= 1.5) return '234,179,8';
    return '16,185,129';
  },
  draw() {
    const cv = $('#plCv');
    const { W, H, s, cx, top, slotY } = this.geo();
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pegR = Math.max(2.5, s * 0.12);
    ctx.fillStyle = '#9a9a9a';
    for (let r = 0; r < this.rows; r++) {
      for (let j = 0; j < r + 3; j++) {
        ctx.beginPath();
        ctx.arc(cx + (j - (r + 2) / 2) * s, top + r * s, pegR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tbl = this.table();
    const sw = s - 4, sh = 22;
    ctx.font = `700 ${Math.max(8, Math.min(11, s * 0.3))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const now = performance.now();
    tbl.forEach((m, k) => {
      const x = cx + (k - this.rows / 2) * s;
      const c = this.slotColor(m);
      const age = this.hits[k] ? (now - this.hits[k]) / 450 : 1;
      const glow = age < 1 ? 1 - age : 0;
      const lift = 4 * glow;
      ctx.fillStyle = `rgba(${c},${.14 + .3 * glow})`;
      ctx.strokeStyle = `rgba(${c},.55)`;
      ctx.lineWidth = 1;
      const y = slotY + lift;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - sw / 2, y, sw, sh, 4) : ctx.rect(x - sw / 2, y, sw, sh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgb(${c})`;
      ctx.fillText(m + 'x', x, y + sh / 2 + 0.5);
    });

    const ballR = Math.max(4, s * 0.2);
    ctx.fillStyle = '#9333ea';
    ctx.shadowColor = 'rgba(147,51,234,.8)';
    ctx.shadowBlur = 10;
    for (const b of this.balls) {
      const p = this.ballPos(b, now);
      ctx.beginPath(); ctx.arc(p.x, p.y, ballR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  },
  segDur(i) { return i === 0 ? 260 : 150; },
  ballPos(b, now) {
    let t = now - b.t0, i = 0;
    while (i < b.pts.length - 2 && t > this.segDur(i)) { t -= this.segDur(i); i++; }
    const u = Math.min(1, t / this.segDur(i));
    const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1];
    const hop = i === 0 ? 0 : b.s * 0.38;
    return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u * u - hop * 4 * u * (1 - u) * (1 - u) };
  },
  totalDur(b) { let d = 0; for (let i = 0; i < b.pts.length - 1; i++) d += this.segDur(i); return d; },
  loop() {
    if (this.raf) return;
    const tick = () => {
      const now = performance.now();
      for (const b of [...this.balls]) {
        if (now - b.t0 < this.totalDur(b)) continue;
        this.balls.splice(this.balls.indexOf(b), 1);
        this.hits[b.slot] = now;
        this.pending -= b.payout;
        setBal(S.balance);
        addEntry(b.entry);
      }
      this.draw();
      const glowing = Object.values(this.hits).some(h => now - h < 450);
      this.raf = this.balls.length || glowing ? requestAnimationFrame(tick) : 0;
      this.button();
    };
    this.raf = requestAnimationFrame(tick);
  },
  button() {
    const btn = $('#plBtn');
    const full = this.balls.length >= this.MAX;
    btn.disabled = full;
    btn.textContent = full ? 'Dropping...' : 'Drop ball';
    const busy = this.balls.length > 0 || this.inflight > 0;
    $$('#plRisk .qb, #plRows .qb').forEach(b => { b.disabled = busy; });
  },
  async drop() {
    if (this.balls.length + this.inflight >= this.MAX) return;
    const bet = readBet('plinko');
    if (bet == null) return;
    const rows = this.rows, risk = this.risk;
    this.inflight++;
    this.button();
    const r = await call('plinko', { bet, risk, rows });
    this.inflight--;
    if (!r.ok) { this.button(); return toast(r.error, 'err'); }

    const payout = r.profit + bet;
    this.pending += payout;
    setBal(r.balance);

    const { s, cx, top, slotY } = this.geo();
    const ballR = Math.max(4, s * 0.2), pegR = Math.max(2.5, s * 0.12);
    const jitter = (Math.random() - 0.5) * s * 0.15;
    const pts = [[cx + jitter, top - s * 1.3]];
    let rights = 0;
    for (let i = 0; i < rows; i++) {
      pts.push([cx + (rights - i / 2) * s, top + i * s - pegR - ballR]);
      rights += r.path[i];
    }
    pts.push([cx + (r.slot - rows / 2) * s, slotY + 11]);
    this.balls.push({ pts, s, t0: performance.now(), slot: r.slot, payout, entry: r.entry });
    this.button();
    this.loop();
  },
};
function segment(id, key) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('.qb');
    if (!b || Plinko.balls.length || Plinko.inflight) return;
    $$(id + ' .qb').forEach(x => x.classList.toggle('on', x === b));
    Plinko[key] = key === 'rows' ? +b.dataset.v : b.dataset.v;
    Plinko.draw();
  });
}
segment('#plRisk', 'risk');
segment('#plRows', 'rows');
$('#plBtn').addEventListener('click', () => Plinko.drop());

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const Blackjack = {
  hand: null, shown: { p: 0, d: 0 }, busy: false,
  card(c, isNew, delay) {
    const cls = (isNew ? ' deal' : '');
    const st = isNew ? ` style="animation-delay:${delay}ms"` : '';
    if (c.hidden) return `<div class="card back${cls}"${st}><img src="img/logo.png" alt=""></div>`;
    const red = c.s === 'H' || c.s === 'D';
    return `<div class="card${red ? ' red' : ''}${cls}"${st}><span class="tl">${esc(c.r)}</span><span class="mid">${SUIT[c.s] || ''}</span><span class="br">${esc(c.r)}</span></div>`;
  },
  renderCards(el, cards, key, startDelay) {
    let d = startDelay;
    const prev = this.shown[key];
    el.innerHTML = cards.map((c, i) => {
      const isNew = i >= prev;
      const html = this.card(c, isNew, isNew ? d : 0);
      if (isNew) d += 140;
      return html;
    }).join('');
    this.shown[key] = cards.filter(c => !c.hidden).length === cards.length ? cards.length : cards.length - 1;
    return d;
  },
  actions() {
    const el = $('#bjActs');
    const h = this.hand;
    if (h && !h.finished) {
      el.innerHTML = `<div class="acts">
        <button class="b-hit" data-a="bjHit">Hit</button>
        <button class="b-stand" data-a="bjStand">Stand</button>
        <button class="b-double" data-a="bjDouble" ${h.canDouble ? '' : 'disabled'}>Double</button></div>`;
    } else {
      el.innerHTML = `<button class="main-btn" style="width:100%" data-a="deal">${h ? SVG.again + 'Play again' : 'Deal'}</button>`;
    }
    $$('button', el).forEach(b => { b.disabled = b.disabled || this.busy; });
  },
  async apply(r, fresh) {
    if (fresh) this.shown = { p: 0, d: 0 };
    this.hand = r;
    $('#bjEmpty').hidden = true;
    $('#bjTable').hidden = false;
    $('#bjRes').innerHTML = '';
    let d = 0;
    if (fresh) {
      this.shown = { p: 0, d: 0 };
      $('#bjPc').innerHTML = r.player.map((c, i) => this.card(c, true, i * 280)).join('');
      $('#bjDc').innerHTML = r.dealer.map((c, i) => this.card(c, true, 140 + i * 280)).join('');
      this.shown = { p: r.player.length, d: r.dealer.some(c => c.hidden) ? 1 : r.dealer.length };
      d = 700;
    } else {
      d = this.renderCards($('#bjPc'), r.player, 'p', 0);
      d = this.renderCards($('#bjDc'), r.dealer, 'd', d);
    }
    $('#bjPs').textContent = r.playerScore;
    $('#bjDs').textContent = r.dealerScore;
    setBal(r.finished ? r.balance - (r.profit + r.bet) : r.balance);
    if (r.finished) {
      this.busy = true;
      this.actions();
      await sleep(d + 250);
      setBal(r.balance);
      addEntry(r.entry);
      const bet = r.bet;
      const label = { Win: 'You win', Loss: 'You lose' }[r.result] || r.result;
      const cls = r.profit > 0 ? 'g' : r.profit < 0 ? 'r' : 'n';
      const sub = r.profit > 0 ? `+${fmt(r.profit + bet)} coins` : r.profit < 0 ? `-${fmt(bet)} coins` : 'Bet returned';
      $('#bjRes').innerHTML = `<strong class="${cls}">${esc(label)}</strong><span>${sub}</span>`;
      this.busy = false;
      lockSide('blackjack', false);
    }
    this.actions();
  },
  async act(a) {
    if (this.busy) return;
    if (a === 'deal') {
      const bet = readBet('blackjack');
      if (bet == null) return;
      this.busy = true; this.actions();
      const r = await call('bjDeal', { bet });
      this.busy = false;
      if (!r.ok) { this.actions(); return toast(r.error, 'err'); }
      lockSide('blackjack', true);
      return this.apply(r, true);
    }
    this.busy = true; this.actions();
    const r = await call(a);
    this.busy = false;
    if (!r.ok) { this.actions(); return toast(r.error, 'err'); }
    this.apply(r, false);
  },
};
$('#bjActs').addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b && !b.disabled) Blackjack.act(b.dataset.a); });

const Hist = {
  filter: 'all', data: null,
  async open(filter = 'all') {
    this.filter = filter;
    show('history');
    $('#hsList').innerHTML = '<div class="none">Loading…</div>';
    const r = await call('history');
    if (!r.ok) return toast(r.error, 'err');
    this.data = r;
    setBal(r.balance);
    this.render();
  },
  render() {
    const { stats, list } = this.data;
    const sum = k => stats.reduce((a, s) => a + Number(s[k] || 0), 0);
    const wag = sum('wagered'), net = sum('net'), n = sum('n');
    $('#hsTiles').innerHTML = `
      <div class="tilebox"><span class="ic">${SVG.wager}</span><div><div class="lbl">Wagered</div><b>${fmt(wag)}<span class="coin sm"></span></b></div></div>
      <div class="tilebox"><span class="ic">${SVG.net}</span><div><div class="lbl">Net</div><b class="${net > 0 ? 'g' : net < 0 ? 'r' : ''}">${signed(net)}<span class="coin sm"></span></b></div></div>
      <div class="tilebox"><span class="ic">${SVG.games}</span><div><div class="lbl">Games</div><b>${fmt(n)}</b></div></div>`;
    const count = g => (stats.find(s => s.game === g) || {}).n || 0;
    $('#hsFilters').innerHTML = [['all', 'All', n],...Object.keys(GAMES).map(g => [g, GAMES[g], count(g)])]
      .map(([k, label, c]) => `<button class="chip${this.filter === k ? ' on' : ''}" data-f="${k}">${label}<span>${fmt(c)}</span></button>`).join('');
    const rows = list.filter(e => this.filter === 'all' || e.game === this.filter);
    $('#hsList').innerHTML = rows.length ? rows.map(e => {
      const d = new Date(Number(e.ts) * 1000);
      const date = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      const cls = e.profit > 0 ? 'g' : e.profit < 0 ? 'r' : 'n';
      return `<div class="hrow"><span class="ic">${ICON[e.game] || ''}</span>
        <div class="t"><strong>${esc(e.title)}</strong><small><span class="gbadge">${GAMES[e.game] || esc(e.game)}</span>${date}</small></div>
        <span class="bet">${fmt(e.bet)}<span class="coin sm"></span></span><span class="pf ${cls}">${signed(e.profit)}</span></div>`;
    }).join('') : '<div class="none">No games here yet</div>';
    $('#btnHistory').classList.toggle('on', this.filter !== 'cases');
    $('#btnInv').classList.toggle('on', this.filter === 'cases');
  },
};
$('#hsFilters').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (c && Hist.data) { Hist.filter = c.dataset.f; Hist.render(); }
});
$('#btnHistory').addEventListener('click', () => { if (!S.reel) Hist.open('all'); });
$('#btnInv').addEventListener('click', () => { if (!S.reel) Hist.open('cases'); });

let built = false;
function build() {
  for (const side of $$('.side[data-game]')) {
    const box = $('.betbox', side);
    if (box) box.outerHTML = betBox(side.dataset.game);
  }
  Mines.build();
  Mines.button();
  Crash.button();
  Blackjack.actions();
  betInput('coinflip').addEventListener('input', () => Coinflip.caption());
  $('.side[data-game="coinflip"] .quick').addEventListener('click', () => setTimeout(() => Coinflip.caption()));
  built = true;
}

function openUI(d) {
  Object.assign(S, {
    balance: d.balance ?? S.balance, cases: d.cases || S.cases, recent: d.recent || S.recent,
    minBet: d.minBet ?? S.minBet, maxBet: d.maxBet ?? S.maxBet, plinko: d.plinko || S.plinko,
    crashHistory: d.crashHistory || S.crashHistory, crashSpeed: d.crashSpeed || S.crashSpeed,
  });
  if (!built) build();
  setBal(S.balance);
  Cases.render();
  Object.keys(GAMES).forEach(renderHist);
  Coinflip.caption();
  Crash.pills();
  $('#reelOv').hidden = true;
  $('#frame').classList.remove('hidden');
  show(S.view === 'case' && S.current ? 'case' : S.view === 'history' ? 'cases' : S.view);
  requestAnimationFrame(() => { Crash.draw(); Plinko.draw(); });
}
function closeUI() {
  if (S.reel) return;
  $('#frame').classList.add('hidden');
  post('close');
  if (!IS_FIVEM) setTimeout(() => $('#frame').classList.remove('hidden'), 700);
}
$('#btnClose').addEventListener('click', closeUI);
document.addEventListener('keyup', e => { if (e.key === 'Escape' && IS_FIVEM) closeUI(); });
window.addEventListener('resize', () => { Crash.draw(); Plinko.draw(); });

function onMessage(d) {
  if (!d || !d.action) return;
  if (d.action === 'open') openUI(d);
  else if (d.action === 'close') $('#frame').classList.add('hidden');
  else if (d.action === 'crash') {
    if (d.event === 'cashed') Crash.onCashed(d);
    else if (d.event === 'crashed') Crash.onCrashed(d);
  }
}
window.addEventListener('message', e => onMessage(e.data));

// feikki serveri selainta varten, pelissä tätä ei käytetä ollenkaa
const Mock = (() => {
  let bal = 25000;
  const now = () => Math.floor(Date.now() / 1000);
  const cool = {};
  let mines = null, crash = null, bj = null, caseBusy = false;
  const crashHist = [1.8, 1.15, 4.5, 1.02, 3.2, 1.41, 3.22, 1.08];
  const K = 0.08;
  const PLINKO = {
    8: { low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6], medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
    10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9], medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22], high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76] },
    12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
  };
  const CASES = [
    { id: 'starter', label: 'Starter Case', price: 250, items: [
      ['$150 Cash', 'common', 50, 150, 'img/cash.png'], ['Body Armor', 'rare', 35, 300, 'img/armor.png'],
      ['$750 Cash', 'epic', 12, 750, 'img/cash.png'], ['$2,500 Cash', 'legendary', 3, 2500, 'img/cash.png']] },
    { id: 'weapon', label: 'Weapon Case', price: 500, items: [
      ['Knife', 'common', 50, 250, 'img/weapons/WEAPON_KNIFE.png'], ['Pistol', 'rare', 35, 600, 'img/weapons/WEAPON_PISTOL.png'],
      ['SMG', 'epic', 12, 1500, 'img/weapons/WEAPON_SMG.png'], ['Carbine Rifle', 'legendary', 3, 5000, 'img/weapons/WEAPON_CARBINERIFLE.png']] },
    { id: 'highroller', label: 'High Roller Case', price: 2500, vip: true, cooldownHours: 24, items: [
      ['Body Armor', 'common', 50, 300, 'img/armor.png'], ['$5,000 Cash', 'rare', 35, 5000, 'img/cash.png'],
      ['$25,000 Cash', 'epic', 12, 25000, 'img/cash.png'], ['Adder', 'legendary', 3, 100000, 'img/car.png']] },
  ].map(c => ({ ...c, items: c.items.map(([label, rarity, weight, value, image]) => ({ label, rarity, weight, value, image, money: /^\$/.test(label) ? value : 0 })) }));

  const hist = [];
  const seed = (game, rows) => rows.forEach(([title, bet, profit]) => hist.push({ game, title, bet, profit, ts: 0 }));
  seed('coinflip', [['Win', 100, 100], ['Loss', 100, -100], ['Win', 2000, 2000], ['Loss', 750, -750], ['Win', 300, 300], ['Win', 250, 250], ['Loss', 250, -250], ['Win', 500, 500], ['Loss', 500, -500], ['Win', 1000, 1000]]);
  seed('mines', [['2.45x', 500, 725], ['Mine', 500, -500], ['1.32x', 100, 32], ['Mine', 100, -100], ['Mine', 250, -250], ['1.92x', 250, 230], ['1.67x', 100, 67]]);
  seed('crash', [['1.8x', 1000, 800], ['1.15x', 400, -400], ['4.5x', 250, 875], ['1.02x', 200, -200], ['3.2x', 200, 440], ['1.41x', 150, -150], ['3.22x', 500, 1110], ['1.08x', 300, -300]]);
  seed('plinko', [['1.4x', 100, 40], ['0.4x', 200, -120], ['1.4x', 200, 80], ['0.4x', 500, -300], ['22x', 100, 2100], ['0.6x', 100, -40]]);
  seed('blackjack', [['Win', 1000, 1000], ['Loss', 200, -200], ['Win', 400, 400], ['Bust!', 600, -600], ['Blackjack!', 250, 375], ['Win', 250, 250], ['Bust!', 250, -250], ['Push', 300, 0], ['Loss', 100, -100], ['Blackjack!', 500, 750]]);
  seed('cases', [['$5,000 Cash', 2500, 2500], ['Body Armor', 250, 50]]);
  hist.forEach((e, i) => { e.ts = now() - 60 - i * 47; });
  hist.sort((a, b) => b.ts - a.ts);

  const ok = o => ({ ok: true, balance: bal, ...o });
  const no = error => ({ ok: false, error });
  const log = (game, title, bet, profit) => { const e = { game, title, bet, profit, ts: now() }; hist.unshift(e); return e; };
  const fmtM = m => fmtMult(m);
  function take(b) {
    b = Math.floor(+b || 0);
    if (b < 100 || b > 10000) return [null, 'Bet must be between 100 and 10,000.'];
    if (bal < b) return [null, 'Not enough coins.'];
    bal -= b;
    return [b];
  }
  function publicCases() {
    return CASES.map(c => {
      const total = c.items.reduce((a, i) => a + i.weight, 0);
      const left = c.cooldownHours && cool[c.id] ? cool[c.id] + c.cooldownHours * 3600 - now() : 0;
      return {
        id: c.id, label: c.label, price: c.price, vip: c.vip, cooldown: c.cooldownHours ? `${c.cooldownHours}h cooldown` : null,
        locked: left > 0, lockReason: left > 0 ? `Available again in ${Math.floor(left / 3600)}h ${Math.floor(left % 3600 / 60)}m.` : null,
        items: c.items.map(i => ({ label: i.label, rarity: i.rarity, image: i.image, chance: Math.round(i.weight / total * 1000) / 10 })),
      };
    });
  }
  const minesMult = (m, k) => {
    if (!k) return 1;
    let x = 1;
    for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i);
    return Math.max(1, Math.floor(x * 0.97 * 100) / 100);
  };
  const score = h => {
    let t = 0, a = 0;
    for (const c of h) { if (c.r === 'A') { t += 11; a++; } else if ('KQJ'.includes(c.r)) t += 10; else t += +c.r; }
    while (t > 21 && a) { t -= 10; a--; }
    return t;
  };
  const isBJ = h => h.length === 2 && score(h) === 21;
  const bjView = (g, extra = {}) => ({
    ok: true, player: g.player, dealer: g.done ? g.dealer : [g.dealer[0], { hidden: true }], bet: g.bet,
    playerScore: score(g.player), dealerScore: score(g.done ? g.dealer : [g.dealer[0]]),
    finished: !!g.done, canDouble: !g.done && g.player.length === 2, balance: bal, ...extra,
  });
  function bjFinish(dealerPlays) {
    const g = bj; g.done = true; bj = null;
    const ps = score(g.player);
    if (dealerPlays && ps <= 21 && !isBJ(g.player)) while (score(g.dealer) < 17) g.dealer.push(g.deck.pop());
    const ds = score(g.dealer);
    let title, payout;
    if (ps > 21) [title, payout] = ['Bust!', 0];
    else if (isBJ(g.player) && isBJ(g.dealer)) [title, payout] = ['Push', g.bet];
    else if (isBJ(g.player)) [title, payout] = ['Blackjack!', Math.floor(g.bet * 2.5)];
    else if (isBJ(g.dealer)) [title, payout] = ['Loss', 0];
    else if (ds > 21 || ps > ds) [title, payout] = ['Win', g.bet * 2];
    else if (ps === ds) [title, payout] = ['Push', g.bet];
    else [title, payout] = ['Loss', 0];
    bal += payout;
    return bjView(g, { result: title, profit: payout - g.bet, entry: log('blackjack', title, g.bet, payout - g.bet) });
  }
  function crashSettle(g, m) {
    g.active = false;
    const payout = Math.floor(g.bet * m);
    bal += payout;
    return ok({ event: 'cashed', multiplier: m, payout, profit: payout - g.bet, entry: log('crash', fmtM(m), g.bet, payout - g.bet) });
  }

  const api = {
    getData: () => ok({ cases: publicCases(), recent: hist.slice(0, 150), minBet: 100, maxBet: 10000, plinko: PLINKO, crashHistory: crashHist, crashSpeed: K }),
    openCase({ id }) {
      const c = CASES.find(x => x.id === id);
      if (!c) return no('Unknown case.');
      if (caseBusy) return no('Wait for the current case to finish.');
      if (publicCases().find(x => x.id === id).locked) return no('This case is on cooldown.');
      if (bal < c.price) return no('Not enough coins.');
      bal -= c.price;
      if (c.cooldownHours) cool[c.id] = now();
      const total = c.items.reduce((a, i) => a + i.weight, 0);
      let r = Math.random() * total, idx = c.items.length - 1;
      for (let i = 0; i < c.items.length; i++) { r -= c.items[i].weight; if (r <= 0) { idx = i; break; } }
      const it = c.items[idx];
      bal += it.money;
      caseBusy = true;
      setTimeout(() => { caseBusy = false; }, 5500);
      return ok({ index: idx, entry: log('cases', it.label, c.price, it.value - c.price), cases: publicCases() });
    },
    coinflip({ bet }) {
      const [b, err] = take(bet); if (!b) return no(err);
      const win = Math.random() < 0.5;
      if (win) bal += b * 2;
      return ok({ win, profit: win ? b : -b, entry: log('coinflip', win ? 'Win' : 'Loss', b, win ? b : -b) });
    },
    minesStart({ bet, mines: count }) {
      if (mines) return no('Finish your current game first.');
      count = Math.floor(+count);
      if (!(count >= 1 && count <= 24)) return no('Pick between 1 and 24 mines.');
      const [b, err] = take(bet); if (!b) return no(err);
      const tiles = [...Array(25).keys()].sort(() => Math.random() - 0.5);
      mines = { bet: b, count, set: new Set(tiles.slice(0, count)), revealed: new Set() };
      return ok({});
    },
    minesReveal({ tile }) {
      const g = mines; if (!g) return no('Start a game first.');
      if (g.revealed.has(tile)) return no('Pick another tile.');
      if (g.set.has(tile)) { mines = null; return ok({ mine: true, tile, mines: [...g.set], profit: -g.bet, entry: log('mines', 'Mine', g.bet, -g.bet) }); }
      g.revealed.add(tile);
      if (g.revealed.size === 25 - g.count) return { ...api.minesCashout(), tile };
      const m = minesMult(g.count, g.revealed.size);
      return ok({ mine: false, tile, multiplier: m, profit: Math.floor(g.bet * m) - g.bet });
    },
    minesCashout() {
      const g = mines; if (!g || !g.revealed.size) return no('Reveal at least one tile first.');
      mines = null;
      const m = minesMult(g.count, g.revealed.size), payout = Math.floor(g.bet * m);
      bal += payout;
      return ok({ cashed: true, multiplier: m, payout, profit: payout - g.bet, mines: [...g.set], entry: log('mines', fmtM(m), g.bet, payout - g.bet) });
    },
    crashStart({ bet, auto }) {
      if (crash) return no('Wait for the current round to end.');
      const [b, err] = take(bet); if (!b) return no(err);
      const point = Math.random() < 0.03 ? 1 : Math.max(1.01, Math.min(1000, Math.floor(0.97 / (1 - Math.random()) * 100) / 100));
      const g = crash = { bet: b, point, start: performance.now(), active: true };
      setTimeout(() => {
        crash = null;
        crashHist.unshift(point); crashHist.length = Math.min(crashHist.length, 8);
        const msg = { action: 'crash', event: 'crashed', point, history: crashHist.slice() };
        if (g.active) { g.active = false; msg.entry = log('crash', fmtM(point), b, -b); msg.balance = bal; }
        onMessage(msg);
      }, Math.log(point) / K * 1000);
      if (auto && auto >= 1.01 && auto < point) {
        setTimeout(() => { if (g.active) onMessage({ ...crashSettle(g, auto), action: 'crash' }); }, Math.log(auto) / K * 1000);
      }
      return ok({});
    },
    crashCashout() {
      const g = crash; if (!g || !g.active) return no('No active bet.');
      const m = Math.floor(Math.exp(K * (performance.now() - g.start) / 1000) * 100) / 100;
      if (m >= g.point) return no('Too late, it crashed.');
      return crashSettle(g, Math.max(1, m));
    },
    plinko({ bet, risk, rows }) {
      const tbl = (PLINKO[rows] || {})[risk]; if (!tbl) return no('Pick a risk level and rows.');
      const [b, err] = take(bet); if (!b) return no(err);
      const path = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
      const slot = path.reduce((a, x) => a + x, 0), m = tbl[slot], payout = Math.floor(b * m);
      bal += payout;
      return ok({ path, slot, multiplier: m, profit: payout - b, entry: log('plinko', fmtM(m), b, payout - b) });
    },
    bjDeal({ bet }) {
      if (bj) return no('Finish your current hand first.');
      const [b, err] = take(bet); if (!b) return no(err);
      const deck = [];
      for (const s of 'SHDC') for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) deck.push({ r, s });
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      bj = { bet: b, deck, player: [deck.pop()], dealer: [deck.pop()] };
      bj.player.push(deck.pop()); bj.dealer.push(deck.pop());
      if (isBJ(bj.player) || isBJ(bj.dealer)) return bjFinish(false);
      return bjView(bj);
    },
    bjHit() {
      if (!bj) return no('Deal a new hand first.');
      bj.player.push(bj.deck.pop());
      const s = score(bj.player);
      if (s > 21) return bjFinish(false);
      if (s === 21) return bjFinish(true);
      return bjView(bj);
    },
    bjStand() { return bj ? bjFinish(true) : no('Deal a new hand first.'); },
    bjDouble() {
      if (!bj) return no('Deal a new hand first.');
      if (bj.player.length !== 2) return no('You can only double on your first two cards.');
      if (bal < bj.bet) return no('Not enough coins to double.');
      bal -= bj.bet; bj.bet *= 2;
      bj.player.push(bj.deck.pop());
      return bjFinish(score(bj.player) <= 21);
    },
    history() {
      const stats = Object.keys(GAMES).map(g => {
        const rows = hist.filter(e => e.game === g);
        return { game: g, n: rows.length, wagered: rows.reduce((a, e) => a + e.bet, 0), net: rows.reduce((a, e) => a + e.profit, 0) };
      }).filter(s => s.n);
      return ok({ stats, list: hist.slice(0, 100) });
    },
  };
  return {
    async call(fn, data) {
      await sleep(120);
      return api[fn] ? JSON.parse(JSON.stringify(api[fn](data || {}))) : no('Unknown action.');
    },
  };
})();

if (!IS_FIVEM) Mock.call('getData').then(d => openUI(d));
