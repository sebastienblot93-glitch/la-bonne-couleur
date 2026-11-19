/* La bonne couleur — logique de l'interface */
(() => {
"use strict";
const F = window.Flags;
const $ = id => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Petits outils ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const parisDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const prettyDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const ord = n => (n === 1 ? "1<sup>er</sup>" : `${n}<sup>e</sup>`);
const ordF = n => (n === 1 ? "1<sup>re</sup>" : `${n}<sup>e</sup>`); // « place » est féminin
const ordTxt = n => (n === 1 ? "1er" : `${n}e`);
const num = n => n.toLocaleString("fr-FR");
const dec = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const plural = (n, one, many) => `${num(n)} ${n > 1 ? many : one}`;

async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `Erreur ${r.status}`); e.status = r.status; throw e; }
  return j;
}

let pid = LS.get("bc.pid");
if (!pid) { pid = uuid(); LS.set("bc.pid", pid); }
const getName = () => (LS.get("bc.name", "") || "").trim();

function verdict(d) {
  if (d < 2) return "Parfait";
  if (d < 5) return "Excellent";
  if (d < 10) return "Très proche";
  if (d < 20) return "Pas mal";
  if (d < 35) return "Bof";
  return "Raté";
}

/* ---------- Écrans ---------- */
let current = "home", previous = "home";
function show(id) {
  if (id !== current) previous = current;
  current = id;
  for (const s of ["home", "game", "end", "boardScreen"]) $(s).hidden = s !== id;
  if (id !== "game") stopAnts();
  window.scrollTo(0, 0);
}

/* ================================================================== */
/* ACCUEIL                                                            */
/* ================================================================== */
function buildFan() {
  const fan = $("fan"); fan.innerHTML = "";
  const picks = [...F.FLAGS].sort(() => Math.random() - .5).slice(0, 7);
  picks.forEach((f, k) => {
    const c = f.c.filter(x => x !== "#FFFFFF" && x !== "#000000");
    const hex = (c.length ? c : f.c)[Math.floor(Math.random() * (c.length || f.c.length))];
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.style.setProperty("--rot", `${(k - 3) * 9}deg`);
    chip.innerHTML = `<i style="background:${hex}"></i><b>${esc(f.n)}</b><small>${hex}</small>`;
    fan.appendChild(chip);
  });
  if (!REDUCED) { fan.classList.add("closed"); requestAnimationFrame(() => requestAnimationFrame(() => fan.classList.remove("closed"))); }
}

function streakInfo() {
  const days = new Set(LS.get("bc.days", []));
  let d = new Date(), n = 0;
  if (!days.has(parisDate(d))) d = new Date(d.getTime() - 864e5);
  while (days.has(parisDate(d))) { n++; d = new Date(d.getTime() - 864e5); }
  return n;
}

function refreshHome() {
  const today = parisDate();
  $("dailyDate").textContent = cap(prettyDate(today));
  const done = LS.get("bc.daily." + today);
  const run = LS.get("bc.run.daily");
  const s = streakInfo();
  const streakTxt = s > 1 ? ` Série : <b>${s} jours</b> d'affilée.` : "";
  if (done) {
    $("streak").innerHTML = `Fait aujourd'hui : <b>${done.total} points</b>.${streakTxt}`;
    $("playDaily").textContent = "Voir le classement du jour";
  } else {
    $("streak").innerHTML = run && run.date === today ? `Partie en cours : manche ${run.results.length + 1} sur 10.${streakTxt}` : streakTxt.trim();
    $("playDaily").textContent = run && run.date === today ? "Reprendre le défi" : "Jouer le défi";
  }
  const best = LS.get("bc.bestFree");
  $("bestFree").innerHTML = best ? `Ton record : <b>${best} points</b>` : "";
  $("name").value = getName();

  api("/api/stats").then(st => {
    const parts = [];
    if (st.today) parts.push(`${plural(st.today, "personne a", "personnes ont")} joué le défi aujourd'hui`);
    if (st.games) parts.push(`${plural(st.games, "partie jouée", "parties jouées")} en tout`);
    $("stats").textContent = parts.length ? cap(parts.join(", ")) + "." : "";
  }).catch(() => { $("stats").textContent = ""; });

  loadBoard("daily", $("previewBoard"), null, 5);
}

$("name").addEventListener("input", e => LS.set("bc.name", e.target.value.slice(0, 18)));
$("playDaily").addEventListener("click", () => {
  if (LS.get("bc.daily." + parisDate())) return openBoard("daily");
  start("daily");
});
$("playFree").addEventListener("click", () => start("free"));
$("openBoard").addEventListener("click", () => openBoard("daily"));

/* ================================================================== */
/* CLASSEMENTS                                                        */
/* ================================================================== */
function boardRow(e) {
  const cells = (e.p || []).map(p => `<i style="opacity:${(.12 + .88 * p / 100).toFixed(2)}"></i>`).join("");
  return `<li class="${e.me ? "me" : ""}"><span class="rk">${e.rank}</span><span class="nm">${esc(e.name)}</span>
    <span class="cells" title="Points par manche">${cells}</span><span class="sc">${e.total}</span><span class="tm">${fmtTime(e.ms)}</span></li>`;
}

async function loadBoard(kind, list, meta, limit) {
  list.innerHTML = `<li class="empty">Chargement du classement…</li>`;
  try {
    const b = await api(`/api/leaderboard?board=${kind}&pid=${encodeURIComponent(pid)}`);
    const rows = b.entries.slice(0, limit || 50);
    if (!rows.length) {
      list.innerHTML = `<li class="empty">${kind === "daily" ? "Personne n'a encore joué le défi aujourd'hui. Lance-toi le premier !" : "Aucune partie libre enregistrée pour l'instant."}</li>`;
    } else list.innerHTML = rows.map(boardRow).join("");
    if (meta) {
      meta.textContent = kind === "daily"
        ? `${cap(prettyDate(b.date))}, ${plural(b.count, "joueur", "joueurs")}.`
        : `${plural(b.count, "joueur", "joueurs")}, meilleur score de chacun.`;
      const inTop = rows.some(r => r.me);
      $("boardMe").innerHTML = b.me && !inTop
        ? `Ta place : <b>${ord(b.me.rank)}</b> avec ${b.me.total} points.`
        : (!b.me && kind === "daily" ? "Tu n'as pas encore joué le défi du jour." : "");
    }
    return b;
  } catch {
    list.innerHTML = `<li class="empty">Classement indisponible pour le moment. Le serveur se réveille peut-être : réessaie dans quelques secondes.</li>`;
    if (meta) { meta.textContent = ""; $("boardMe").textContent = ""; }
  }
}

let boardKind = "daily";
function openBoard(kind) {
  boardKind = kind; show("boardScreen");
  $("tabDaily").setAttribute("aria-selected", kind === "daily");
  $("tabFree").setAttribute("aria-selected", kind === "free");
  loadBoard(kind, $("fullBoard"), $("boardMeta"));
}
$("tabDaily").addEventListener("click", () => openBoard("daily"));
$("tabFree").addEventListener("click", () => openBoard("free"));
$("boardBack").addEventListener("click", () => { if (previous === "end") show("end"); else { show("home"); refreshHome(); } });

/* ================================================================== */
/* JEU                                                                */
/* ================================================================== */
const G = { mode: "free", date: "", token: null, rounds: [], results: [], t0: 0, offline: false, phase: "guess", h: 0, s: 0, v: 0, t: 0, showMine: false, timer: 0, saved: null };
const cur = () => F.toHex(F.hsv2rgb(G.h, G.s, G.v));
const flagOf = i => F.BY_ID[G.rounds[i].id];

async function start(mode) {
  const btns = [$("playDaily"), $("playFree")]; btns.forEach(b => (b.disabled = true));
  try {
    const today = parisDate();
    const run = LS.get("bc.run.daily");
    if (mode === "daily" && run && run.date === today) {
      Object.assign(G, { mode, date: run.date, token: run.token, rounds: run.rounds, results: run.results, t0: run.t0, offline: !!run.offline });
    } else {
      let data;
      try { data = await api(`/api/game?mode=${mode}`); G.offline = false; }
      catch {
        G.offline = true;
        data = { token: null, date: today, rounds: F.generate(mode === "daily" ? "hors-ligne:" + today : "hors-ligne:" + Math.random()) };
      }
      Object.assign(G, { mode, date: data.date, token: data.token, rounds: data.rounds, results: [], t0: Date.now() });
      saveRun();
    }
  } finally { btns.forEach(b => (b.disabled = false)); }
  $("hudMode").textContent = mode === "daily" ? "Défi du jour" : "Partie libre";
  show("game");
  buildStrip();
  clearInterval(G.timer); G.timer = setInterval(tick, 500); tick();
  startRound();
}
function saveRun() {
  if (G.mode !== "daily") return;
  LS.set("bc.run.daily", { date: G.date, token: G.token, rounds: G.rounds, results: G.results, t0: G.t0, offline: G.offline });
}
const tick = () => { $("hudTime").textContent = fmtTime(Date.now() - G.t0); };

function buildStrip() {
  $("strip").innerHTML = G.rounds.map((_, i) => `<li data-n="${i + 1}"></li>`).join("");
  G.results.forEach((r, i) => paintChip(i, r));
  $("runTotal").textContent = G.results.reduce((a, r) => a + r.pts, 0);
}
function paintChip(i, r) {
  const li = $("strip").children[i];
  li.className = "done"; li.dataset.pts = r.pts;
  li.title = `${F.BY_ID[r.id].n} : ${r.pts} points`;
  li.innerHTML = `<i style="background:${r.guess}"></i><i style="background:${r.truth}"></i>`;
}

function startRound() {
  const i = G.results.length, r = G.rounds[i], flag = flagOf(i);
  G.phase = "guess"; G.showMine = false; G.t = r.t;
  [G.h, G.s, G.v] = r.start;
  [...$("strip").children].forEach((li, k) => { if (k === i) li.classList.add("cur"); });
  $("prompt").innerHTML = `<b>${esc(flag.n)}</b>Une couleur est fausse sur ce drapeau. Retrouve la bonne.`;
  $("flagHint").textContent = "La zone entourée de pointillés a la mauvaise couleur.";
  $("guessPanel").hidden = false; $("revealPanel").hidden = true;
  $("flag").classList.remove("clickable");
  renderFlag(); update();
}

/* ---------- Rendu du drapeau + contour animé ---------- */
function fitSize(flag, maxW, maxH) { const r = flag.W / flag.H; let w = maxW, h = maxW / r; if (h > maxH) { h = maxH; w = maxH * r; } return [Math.round(w), Math.round(h)]; }

function renderFlag() {
  const i = G.results.length - (G.phase === "result" ? 1 : 0);
  const flag = flagOf(i), el = $("flag"), stage = el.parentElement;
  const small = window.innerWidth < 520;
  const [w, h] = fitSize(flag, Math.min(small ? 330 : 440, stage.clientWidth - 8), small ? 200 : 270);
  let f;
  if (G.phase === "guess") f = k => `var(--c${k})`;
  else { const res = G.results[i]; f = G.showMine ? (k => (k === G.t ? res.guess : flag.c[k])) : (k => flag.c[k]); }
  el.innerHTML = F.flagSVG(flag, f, w, h);
  if (G.phase === "guess") {
    const svg = el.querySelector("svg");
    flag.c.forEach((c, k) => svg.style.setProperty("--c" + k, k === G.t ? cur() : c));
    startAnts(el, flag, G.t, w, h);
  } else {
    stopAnts();
    el.insertAdjacentHTML("beforeend", `<span class="flag-tag">${G.showMine ? "Ta version" : "Le vrai drapeau"}</span>`);
  }
}

let ants = null, antsTimer = 0;
function stopAnts() { clearInterval(antsTimer); antsTimer = 0; ants = null; }
function startAnts(el, flag, t, w, h) {
  stopAnts();
  const dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  const img = new Image(), token = {};
  ants = token;
  img.onload = () => {
    if (ants !== token) return;
    const off = document.createElement("canvas"); off.width = pw; off.height = ph;
    const ox = off.getContext("2d"); ox.fillStyle = "#000"; ox.fillRect(0, 0, pw, ph); ox.drawImage(img, 0, 0, pw, ph);
    const d = ox.getImageData(0, 0, pw, ph).data, N = pw * ph, m = new Uint8Array(N);
    for (let p = 0; p < N; p++) m[p] = d[p * 4] > 127 ? 1 : 0;
    const th = Math.max(2, Math.round(2 * dpr));
    let edge = new Uint8Array(N);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const p = y * pw + x; if (!m[p]) continue;
      if (x === 0 || y === 0 || x === pw - 1 || y === ph - 1 || !m[p - 1] || !m[p + 1] || !m[p - pw] || !m[p + pw]) edge[p] = 1; }
    for (let k = 1; k < th; k++) { const nx = edge.slice();
      for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) { const p = y * pw + x;
        if (m[p] && !edge[p] && (edge[p - 1] || edge[p + 1] || edge[p - pw] || edge[p + pw])) nx[p] = 1; }
      edge = nx; }
    const idx = []; for (let p = 0; p < N; p++) if (edge[p]) idx.push(p);
    const cv = document.createElement("canvas"); cv.width = pw; cv.height = ph; cv.style.width = w + "px"; cv.style.height = h + "px";
    el.appendChild(cv);
    const cx = cv.getContext("2d"), out = cx.createImageData(pw, ph), u32 = new Uint32Array(out.data.buffer);
    const BLACK = 0xff1c1c1c, WHITE = 0xffffffff, dash = Math.round(4 * dpr);
    let o = 0;
    const draw = () => { for (const p of idx) { const x = p % pw, y = (p / pw) | 0;
        u32[p] = ((Math.floor((x + o) / dash) + Math.floor((y + o) / dash)) & 1) ? BLACK : WHITE; }
      cx.putImageData(out, 0, 0); o = (o + Math.max(1, Math.round(dpr))) % (dash * 2); };
    draw();
    if (!REDUCED) antsTimer = setInterval(() => { if (ants === token) draw(); }, 70);
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(F.flagSVG(flag, k => (k === t ? "#fff" : "#000"), pw, ph));
}

/* ---------- Curseurs ---------- */
function slider(el, get, set) {
  const thumb = el.querySelector(".thumb");
  const pos = () => { const v = get(); thumb.style.left = `calc(16px + ${v} * (100% - 32px))`; el.setAttribute("aria-valuenow", Math.round(v * 100)); };
  const fromX = x => { const r = el.getBoundingClientRect(); set(clamp((x - r.left - 16) / (r.width - 32), 0, 1)); };
  el.addEventListener("pointerdown", e => { if (G.phase !== "guess") return; el.setPointerCapture(e.pointerId); el.focus(); fromX(e.clientX); e.preventDefault(); });
  el.addEventListener("pointermove", e => { if (el.hasPointerCapture(e.pointerId)) fromX(e.clientX); });
  el.addEventListener("keydown", e => {
    const st = e.shiftKey ? .05 : .004;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { set(clamp(get() + st, 0, 1)); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { set(clamp(get() - st, 0, 1)); e.preventDefault(); }
  });
  return pos;
}
const posH = slider($("sH"), () => G.h / 360, x => { G.h = x * 360; update(); });
const posS = slider($("sS"), () => G.s, x => { G.s = x; update(); });
const posV = slider($("sV"), () => G.v, x => { G.v = x; update(); });

function update(skipHex) {
  const hex = cur(), hx = c => F.toHex(c);
  $("sS").style.background = `linear-gradient(to right, ${hx(F.hsv2rgb(G.h, 0, G.v))}, ${hx(F.hsv2rgb(G.h, 1, G.v))})`;
  $("sV").style.background = `linear-gradient(to right, #000, ${hx(F.hsv2rgb(G.h, G.s, 1))})`;
  $("sH").querySelector(".thumb").style.setProperty("--c", hx(F.hsv2rgb(G.h, 1, 1)));
  $("sS").querySelector(".thumb").style.setProperty("--c", hx(F.hsv2rgb(G.h, G.s, G.v)));
  $("sV").querySelector(".thumb").style.setProperty("--c", hx(F.hsv2rgb(0, 0, G.v)));
  posH(); posS(); posV();
  $("swatch").style.background = hex;
  if (!skipHex) $("hex").value = hex;
  const svg = $("flag").querySelector("svg");
  if (svg && G.phase === "guess") svg.style.setProperty("--c" + G.t, hex);
}

$("hex").addEventListener("input", e => {
  let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) { const [h, s, b] = F.rgb2hsv(F.fromHex(v)); if (s > 0 && b > 0) G.h = h; if (b > 0) G.s = s; G.v = b; update(true); }
});
$("hex").addEventListener("blur", () => update());

/* ---------- Valider / manche suivante ---------- */
function submit() {
  if (G.phase !== "guess") return;
  const i = G.results.length, r = G.rounds[i], flag = flagOf(i);
  const guess = cur(), truth = flag.c[r.t], d = F.dE(guess, truth), pts = F.points(d);
  const res = { id: r.id, t: r.t, guess, truth, d, pts };
  G.results.push(res); G.phase = "result"; saveRun();
  paintChip(i, res);
  const total = G.results.reduce((a, x) => a + x.pts, 0);
  $("runTotal").textContent = total;

  $("verdict").textContent = verdict(d);
  $("delta").textContent = `Écart de ${dec(d)} (ΔE 2000)`;
  const ink = hex => (F.lab(hex)[0] > 60 ? "#1c1c1c" : "#ffffff");
  for (const [id, hex, label] of [["splitYou", guess, "Ta couleur"], ["splitTrue", truth, "La vraie"]]) {
    const el = $(id); el.style.background = hex; el.style.color = ink(hex);
    el.querySelector("span").textContent = label; el.querySelector("b").textContent = hex;
  }
  countUp($("gain"), pts);
  $("next").textContent = G.results.length >= G.rounds.length ? "Voir mon score" : "Manche suivante";
  $("guessPanel").hidden = true; $("revealPanel").hidden = false;
  $("flag").classList.add("clickable");
  $("flagHint").textContent = "Touche le drapeau pour comparer avec ta version.";
  renderFlag();
  $("next").focus({ preventScroll: true });
}

function countUp(el, to) {
  if (REDUCED) { el.textContent = `+${to}`; return; }
  const t0 = performance.now(), dur = 550;
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = `+${Math.round(to * e)}`; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function next() {
  if (G.results.length >= G.rounds.length) return finish();
  startRound();
}

$("submit").addEventListener("click", submit);
$("next").addEventListener("click", next);
$("flag").addEventListener("click", () => { if (G.phase === "result") { G.showMine = !G.showMine; renderFlag(); } });

let quitArmed = 0;
$("quit").addEventListener("click", () => {
  if (!quitArmed) {
    $("quit").textContent = G.mode === "daily" ? "Quitter ? Ta progression est gardée" : "Quitter ? La partie sera perdue";
    quitArmed = setTimeout(() => { quitArmed = 0; $("quit").textContent = "Quitter"; }, 3000);
    return;
  }
  clearTimeout(quitArmed); quitArmed = 0; $("quit").textContent = "Quitter";
  clearInterval(G.timer); show("home"); refreshHome();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || current !== "game") return;
  if (e.target.tagName === "BUTTON") return; // le bouton gère lui-même la touche Entrée
  e.preventDefault();
  if (G.phase === "guess") submit(); else next();
});

let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (current === "game") renderFlag(); }, 150); });

/* ================================================================== */
/* FIN DE PARTIE                                                      */
/* ================================================================== */
function finish() {
  clearInterval(G.timer);
  const total = G.results.reduce((a, r) => a + r.pts, 0), ms = Date.now() - G.t0;
  G.saved = null;
  show("end");
  $("endMode").textContent = G.mode === "daily" ? `Défi du ${prettyDate(G.date)}` : "Partie libre";
  $("endTotal").textContent = total;
  $("recap").innerHTML = G.results.map(r => {
    const f = F.BY_ID[r.id], [w, h] = fitSize(f, 44, 28);
    return `<li><div class="halves"><i style="background:${r.guess}"></i><i style="background:${r.truth}"></i></div>
      <div class="mini">${F.flagSVG(f, k => f.c[k], w, h)}</div><b>${esc(f.n)}</b>
      <small><span><strong>${r.pts}</strong> pts</span><span>écart ${dec(r.d)}</span></small></li>`;
  }).join("");
  $("toast").textContent = "";

  if (G.mode === "daily") {
    LS.set("bc.daily." + G.date, { total, p: G.results.map(r => r.pts), ms });
    const days = new Set(LS.get("bc.days", [])); days.add(G.date); LS.set("bc.days", [...days].slice(-120));
    LS.del("bc.run.daily");
  } else if (total > (LS.get("bc.bestFree") || 0)) LS.set("bc.bestFree", total);

  G.final = { total, ms };
  $("again").textContent = G.mode === "daily" ? "Lancer une partie libre" : "Rejouer";
  $("saveForm").hidden = true;
  if (G.offline || !G.token) {
    $("endRank").textContent = "Score non enregistré : le serveur était injoignable au début de la partie.";
  } else if (getName().length >= 2) {
    sendScore(getName());
  } else {
    $("endRank").textContent = "";
    $("saveForm").hidden = false; $("saveName").focus();
  }
}

async function sendScore(name) {
  $("endRank").textContent = "Enregistrement du score…";
  try {
    const r = await api("/api/score", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: G.token, guesses: G.results.map(x => x.guess), name, pid }) });
    G.saved = r;
    $("endTotal").textContent = r.total;
    const me = r.me, people = plural(r.count, "joueur", "joueurs");
    let txt;
    if (r.mode === "daily" && r.already) txt = `Tu avais déjà joué le défi aujourd'hui : ton premier score (${me.total}) reste au classement, à la <b>${ordF(me.rank)}</b> place.`;
    else if (r.mode === "daily") txt = `Tu es <b>${ord(me.rank)}</b> sur ${people} aujourd'hui, en ${fmtTime(r.ms)}.`;
    else if (r.stored) txt = `Nouveau record personnel ! Tu es <b>${ord(me.rank)}</b> sur ${people} en partie libre.`;
    else txt = `Ton record reste ${me.total} points, à la <b>${ordF(me.rank)}</b> place sur ${people}.`;
    $("endRank").innerHTML = txt;
    if (r.mode === "daily") { const d = LS.get("bc.daily." + G.date) || {}; LS.set("bc.daily." + G.date, { ...d, rank: me.rank }); }
  } catch (e) {
    if (e.status === 400 && /pseudo/i.test(e.message)) { $("endRank").textContent = e.message; $("saveForm").hidden = false; return; }
    $("endRank").innerHTML = `${esc(e.message)} <button class="link" id="retry">Réessayer</button>`;
    $("retry").addEventListener("click", () => sendScore(name));
  }
}

$("saveForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("saveName").value.trim();
  if (name.length < 2) { $("endRank").textContent = "Choisis un pseudo d'au moins 2 caractères."; return; }
  LS.set("bc.name", name.slice(0, 18)); $("saveForm").hidden = true; sendScore(name);
});

function shareText() {
  const sq = p => (p >= 90 ? "🟩" : p >= 70 ? "🟨" : p >= 40 ? "🟧" : "🟥");
  const total = G.saved ? G.saved.total : G.final.total;
  const head = G.mode === "daily" ? `La bonne couleur, défi du ${prettyDate(G.date)}` : "La bonne couleur, partie libre";
  const rank = G.saved && G.saved.mode === "daily" && !G.saved.already ? ` (${ordTxt(G.saved.me.rank)} du jour)` : "";
  return `${head}\n${total}/1000 en ${fmtTime(G.saved ? G.saved.ms : G.final.ms)}${rank}\n${G.results.map(r => sq(r.pts)).join("")}\n${location.origin}`;
}
$("share").addEventListener("click", async () => {
  const text = shareText();
  try { await navigator.clipboard.writeText(text); $("toast").textContent = "Résultat copié. Colle-le où tu veux."; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* rien */ }
    ta.remove(); $("toast").textContent = ok ? "Résultat copié. Colle-le où tu veux." : text;
  }
});
$("endBoard").addEventListener("click", () => openBoard(G.mode === "daily" ? "daily" : "free"));
$("again").addEventListener("click", () => start("free"));
$("endHome").addEventListener("click", () => { show("home"); refreshHome(); });

/* ---------- Démarrage ---------- */
buildFan();
refreshHome();
})();
