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

const LEVEL_TXT = {
  facile: "Drapeaux connus et couleurs franches.",
  moyen: "Un mélange équilibré de drapeaux connus et moins connus.",
  difficile: "Drapeaux rares et nuances subtiles. Curseurs seulement, sans code couleur.",
};
const LEVEL_NAME = { facile: "facile", moyen: "moyen", difficile: "difficile" };
let level = LEVEL_TXT[LS.get("bc.level")] ? LS.get("bc.level") : "moyen";
function setSeg(el, attr, value, disabled) {
  for (const b of el.querySelectorAll("button")) { b.setAttribute("aria-checked", String(b.dataset[attr] === String(value))); b.disabled = !!disabled; }
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
  for (const s of ["home", "game", "end", "boardScreen", "lobby", "duelEnd"]) $(s).hidden = s !== id;
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
  setSeg($("levelPick"), "level", level);
  $("levelDesc").textContent = LEVEL_TXT[level] + " Rejoue autant que tu veux, seul ton meilleur score compte.";
  const best = LS.get("bc.best." + level);
  $("bestFree").innerHTML = best ? `Ton record en ${LEVEL_NAME[level]} : <b>${best} points</b>` : "";
  $("name").value = getName();

  api("/api/stats").then(st => {
    const parts = [];
    if (st.today) parts.push(`${plural(st.today, "personne a", "personnes ont")} joué le défi aujourd'hui`);
    if (st.games) parts.push(`${plural(st.games, "partie jouée", "parties jouées")} en tout`);
    if (st.duels) parts.push(plural(st.duels, "duel disputé", "duels disputés"));
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
$("levelPick").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  level = b.dataset.level; boardLvl = level; LS.set("bc.level", level); refreshHome();
});
$("openBoard").addEventListener("click", () => openBoard("daily"));

/* ================================================================== */
/* CLASSEMENTS                                                        */
/* ================================================================== */
function boardRow(e) {
  const cells = (e.p || []).map(p => `<i style="opacity:${(.12 + .88 * p / 100).toFixed(2)}"></i>`).join("");
  return `<li class="${e.me ? "me" : ""}"><span class="rk">${e.rank}</span><span class="nm">${esc(e.name)}</span>
    <span class="cells" title="Points par manche">${cells}</span><span class="sc">${e.total}</span><span class="tm">${fmtTime(e.ms)}</span></li>`;
}

async function loadBoard(kind, list, meta, limit, lvl) {
  list.innerHTML = `<li class="empty">Chargement du classement…</li>`;
  try {
    const b = await api(`/api/leaderboard?board=${kind}${kind === "free" ? "&level=" + (lvl || level) : ""}&pid=${encodeURIComponent(pid)}`);
    const rows = b.entries.slice(0, limit || 50);
    if (!rows.length) {
      list.innerHTML = `<li class="empty">${kind === "daily" ? "Personne n'a encore joué le défi aujourd'hui. Lance-toi le premier !" : `Aucune partie libre en niveau ${LEVEL_NAME[b.level]} pour l'instant.`}</li>`;
    } else list.innerHTML = rows.map(boardRow).join("");
    if (meta) {
      meta.textContent = kind === "daily"
        ? `${cap(prettyDate(b.date))}, ${plural(b.count, "joueur", "joueurs")}.`
        : `Niveau ${LEVEL_NAME[b.level]}, ${plural(b.count, "joueur", "joueurs")}, meilleur score de chacun.`;
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

let boardKind = "daily", boardLvl = level;
function openBoard(kind, lvl) {
  boardKind = kind; if (lvl) boardLvl = lvl;
  if (current !== "boardScreen") show("boardScreen");
  $("tabDaily").setAttribute("aria-selected", kind === "daily");
  $("tabFree").setAttribute("aria-selected", kind === "free");
  $("boardLevel").hidden = kind !== "free";
  setSeg($("boardLevel"), "level", boardLvl);
  loadBoard(kind, $("fullBoard"), $("boardMeta"), 50, boardLvl);
}
$("tabDaily").addEventListener("click", () => openBoard("daily"));
$("tabFree").addEventListener("click", () => openBoard("free"));
$("boardLevel").addEventListener("click", e => { const b = e.target.closest("button"); if (b) openBoard("free", b.dataset.level); });
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
      try { data = await api(`/api/game?mode=${mode}${mode === "free" ? "&level=" + level : ""}`); G.offline = false; }
      catch {
        G.offline = true;
        data = { token: null, date: today, rounds: F.generate(mode === "daily" ? "hors-ligne:" + today : "hors-ligne:" + Math.random(), F.ROUNDS, { level: mode === "daily" ? "daily" : level }) };
      }
      Object.assign(G, { mode, date: data.date, token: data.token, rounds: data.rounds, results: [], t0: Date.now() });
      saveRun();
    }
  } finally { btns.forEach(b => (b.disabled = false)); }
  G.level = mode === "free" ? level : null;
  $("hudMode").textContent = mode === "daily" ? "Défi du jour" : `Partie libre, ${LEVEL_NAME[level]}`;
  setDuelUI(false);
  show("game");
  buildStrip();
  clearInterval(G.timer); G.timer = setInterval(tick, 500); tick();
  startRound();
}
function saveRun() {
  if (G.mode !== "daily") return;
  LS.set("bc.run.daily", { date: G.date, token: G.token, rounds: G.rounds, results: G.results, t0: G.t0, offline: G.offline });
}
const tick = () => { if (G.mode !== "duel") $("hudTime").textContent = fmtTime(Date.now() - G.t0); };

function buildStrip() {
  $("strip").style.setProperty("--n", G.rounds.length);
  $("strip").innerHTML = Array.from({ length: G.rounds.length }, (_, i) => `<li data-n="${i + 1}"></li>`).join("");
  G.results.forEach((r, i) => paintChip(i, r));
  $("runTotal").textContent = G.results.reduce((a, r) => a + r.pts, 0);
}
function paintChip(i, r) {
  const li = $("strip").children[i];
  li.className = "done"; li.dataset.pts = r.pts;
  li.title = `${F.BY_ID[r.id].n} : ${r.pts} points`;
  li.innerHTML = (r.guess ? `<i style="background:${r.guess}"></i>` : `<i class="none"></i>`) + `<i style="background:${r.truth}"></i>`;
}

function currentLevel() {
  if (G.mode === "duel") return D && D.s ? D.s.level : null;
  return G.mode === "free" ? G.level : null;
}

function startRound() {
  const i = G.results.length, r = G.rounds[i], flag = flagOf(i);
  G.phase = "guess"; G.showMine = false; G.t = r.t;
  [G.h, G.s, G.v] = r.start;
  [...$("strip").children].forEach((li, k) => { if (k === i) li.classList.add("cur"); });
  const lvl = r.lvl || 3, lv = currentLevel();
  const pips = `<span class="pips-wrap" title="Difficulté de la manche : ${lvl} sur 5"><span>Difficulté</span><span class="pips" aria-label="Difficulté ${lvl} sur 5">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= lvl ? "on" : ""}"></i>`).join("")}</span></span>`;
  $("prompt").innerHTML = `<b>${esc(flag.n)}</b>${pips}Une couleur est fausse sur ce drapeau. Retrouve la bonne.`;
  $("flagHint").textContent = "La zone entourée de pointillés a la mauvaise couleur.";
  $("hex").hidden = lv === "difficile";
  $("guessPanel").hidden = false; $("revealPanel").hidden = true; $("waitPanel").hidden = true;
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
  else { const res = G.results[i]; f = G.showMine && res.guess ? (k => (k === G.t ? res.guess : flag.c[k])) : (k => flag.c[k]); }
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
  if (G.mode === "duel") return duelSubmit();
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
  if (G.mode === "duel") return;
  if (G.results.length >= G.rounds.length) return finish();
  startRound();
}

$("submit").addEventListener("click", submit);
$("next").addEventListener("click", next);
$("flag").addEventListener("click", () => {
  if (G.phase !== "result") return;
  const res = G.results[G.results.length - 1];
  if (!res || !res.guess) return;
  G.showMine = !G.showMine; renderFlag();
});

let quitArmed = 0;
$("quit").addEventListener("click", () => {
  if (!quitArmed) {
    $("quit").textContent = G.mode === "daily" ? "Quitter ? Ta progression est gardée" : G.mode === "duel" ? "Quitter ? Tu perdras par forfait" : "Quitter ? La partie sera perdue";
    quitArmed = setTimeout(() => { quitArmed = 0; $("quit").textContent = "Quitter"; }, 3000);
    return;
  }
  clearTimeout(quitArmed); quitArmed = 0; $("quit").textContent = "Quitter";
  if (G.mode === "duel") return duelLeave();
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
  $("endMode").textContent = G.mode === "daily" ? `Défi du ${prettyDate(G.date)}` : `Partie libre, ${LEVEL_NAME[G.level]}`;
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
  } else if (total > (LS.get("bc.best." + G.level) || 0)) LS.set("bc.best." + G.level, total);

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
    else if (r.stored) txt = `Nouveau record personnel ! Tu es <b>${ord(me.rank)}</b> sur ${people} en partie libre, niveau ${LEVEL_NAME[G.level]}.`;
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
  const head = G.mode === "daily" ? `La bonne couleur, défi du ${prettyDate(G.date)}` : `La bonne couleur, partie libre (${LEVEL_NAME[G.level]})`;
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
$("endBoard").addEventListener("click", () => (G.mode === "daily" ? openBoard("daily") : openBoard("free", G.level)));
$("again").addEventListener("click", () => start("free"));
$("endHome").addEventListener("click", () => { show("home"); refreshHome(); });

/* ================================================================== */
/* DUEL                                                               */
/* ================================================================== */
let D = null; // { code, key, es, s, offset, roundKey, revealKey, sent }

function setDuelUI(on) {
  $("duelBar").hidden = !on;
  $("splitOpp").hidden = !on;
  $("revealPanel").querySelector(".split").classList.toggle("three", on);
  $("oppLine").hidden = !on;
  $("autoNext").hidden = !on;
  $("next").hidden = on;
  $("waitPanel").hidden = true;
  $("hudTime").classList.remove("urgent");
  for (const id of ["splitYou", "splitOpp", "splitTrue"]) $(id).classList.remove("none");
}

const duelPost = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const duelAction = (type, extra = {}) => duelPost("/api/duel/action", { code: D.code, pid, key: D.key, type, ...extra });
const inviteUrl = code => `${location.origin}/?salle=${code}`;
const left = () => (D && D.s ? D.s.deadline - (Date.now() + D.offset) : 0);
const oppName = () => (D && D.s && D.s.opp ? D.s.opp.name : "ton adversaire");

function duelError(msg) { $("duelErr").textContent = msg || ""; }

function needName() {
  const n = ($("name").value || "").trim();
  if (n.length < 2) {
    duelError("Choisis d'abord un pseudo, juste au-dessus.");
    $("name").focus();
    return null;
  }
  LS.set("bc.name", n.slice(0, 18));
  return n;
}

async function duelCreate() {
  const name = needName(); if (!name) return;
  duelError(""); $("duelCreate").disabled = true;
  try { const r = await duelPost("/api/duel/create", { pid, name }); enterRoom(r.code, r.key); }
  catch (e) { duelError(e.message); }
  finally { $("duelCreate").disabled = false; }
}

async function duelJoin(code) {
  const name = needName(); if (!name) return;
  code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) { duelError("Le code d'une salle fait 4 caractères."); $("joinCode").focus(); return; }
  duelError("");
  try { const r = await duelPost("/api/duel/join", { pid, name, code }); enterRoom(r.code, r.key); }
  catch (e) { duelError(e.message); }
}

function enterRoom(code, key) {
  if (D && D.es) D.es.close();
  D = { code, key, es: null, s: null, offset: 0, roundKey: "", revealKey: "", sent: false, endKey: "" };
  LS.set("bc.duel", { code, key });
  try { history.replaceState(null, "", `/?salle=${code}`); } catch { /* navigation figée */ }
  $("roomCode").textContent = code;
  $("inviteLink").value = inviteUrl(code);
  $("seatMe").className = "seat"; $("seatMe").innerHTML = `<span class="nm">${esc(getName())}</span><span class="st">Connexion…</span>`;
  $("seatOpp").className = "seat empty"; $("seatOpp").innerHTML = `<span class="st">En attente d'un adversaire…</span>`;
  $("lobbyStatus").textContent = ""; $("lobbyStatus").className = "lobby-status";
  show("lobby");
  const es = new EventSource(`/api/duel/stream?code=${code}&pid=${encodeURIComponent(pid)}&key=${encodeURIComponent(key)}`);
  D.es = es;
  es.addEventListener("state", e => { if (D && D.es === es) duelSync(JSON.parse(e.data)); });
  es.onerror = () => {
    if (!D || D.es !== es) return;
    if (es.readyState === EventSource.CLOSED) exitRoom("Cette salle n'existe plus. Le serveur a peut-être redémarré : crée une nouvelle salle.");
    else if (current === "lobby") $("lobbyStatus").textContent = "Connexion perdue, reconnexion…";
  };
  clearInterval(G.timer); G.timer = setInterval(duelTick, 200);
}

function exitRoom(msg) {
  if (D && D.es) D.es.close();
  D = null; LS.del("bc.duel");
  clearInterval(G.timer); G.mode = "free"; setDuelUI(false);
  try { history.replaceState(null, "", "/"); } catch { /* idem */ }
  show("home"); refreshHome(); duelError(msg || "");
}

async function duelLeave() {
  if (D) { try { await duelAction("leave"); } catch { /* la salle a peut-être disparu */ } }
  exitRoom("");
}

/* ---------- Réception de l'état ---------- */
function duelSync(s) {
  D.s = s; D.offset = s.now - Date.now();
  if (s.phase === "lobby" || s.phase === "countdown") { if (current !== "lobby") show("lobby"); renderLobby(s); }
  else if (s.phase === "play" || s.phase === "reveal") duelRound(s);
  else if (s.phase === "end") renderDuelEnd(s);
  duelTick();
}

function seatHTML(p, me) {
  if (!p) return `<span class="st">En attente d'un adversaire…</span>`;
  const st = !p.online ? "Déconnecté" : p.ready ? "Prêt" : "Pas encore prêt";
  return `<span class="nm">${esc(me ? p.name + " (toi)" : p.name)}</span><span class="st">${st}</span>`;
}

function renderLobby(s) {
  $("roomCode").textContent = s.code;
  $("seatMe").className = "seat" + (s.me.ready ? " ready" : "");
  $("seatMe").innerHTML = seatHTML(s.me, true);
  $("seatOpp").className = "seat" + (!s.opp ? " empty" : s.opp.ready ? " ready" : "");
  $("seatOpp").innerHTML = seatHTML(s.opp, false);
  for (const b of $("roundsPick").querySelectorAll("button")) {
    b.setAttribute("aria-checked", +b.dataset.n === s.n); b.disabled = !s.host || s.phase !== "lobby";
  }
  $("roundsPick").title = s.host ? "" : "Le créateur de la salle choisit le nombre de manches.";
  setSeg($("duelLevel"), "level", s.level, !s.host || s.phase !== "lobby");
  $("duelLevel").title = s.host ? LEVEL_TXT[s.level] : "Le créateur de la salle choisit le niveau.";
  $("duelLevelNote").textContent = (LEVEL_TXT[s.level] || "") + (s.host ? "" : " Le créateur de la salle choisit les réglages.");
  const counting = s.phase === "countdown";
  $("readyBtn").hidden = counting;
  $("readyBtn").textContent = s.me.ready ? "Je ne suis plus prêt" : "Je suis prêt";
  $("readyBtn").classList.toggle("primary", !s.me.ready);
  $("lobbyStatus").className = "lobby-status" + (counting ? " count" : "");
  if (!counting) {
    $("lobbyStatus").textContent = !s.opp ? "Dès que ton adversaire arrive, cliquez tous les deux sur « Je suis prêt »."
      : !s.opp.ready && !s.me.ready ? "Cliquez tous les deux sur « Je suis prêt » pour lancer le duel."
      : !s.opp.ready ? `En attente de ${s.opp.name}…`
      : !s.me.ready ? `${s.opp.name} est prêt. À toi !` : "";
  }
}

function duelRound(s) {
  const key = `${s.game}:${s.idx}`;
  if (current !== "game" || G.mode !== "duel") {
    G.mode = "duel"; G.rounds = Array.from({ length: s.n }, () => null); G.results = [];
    setDuelUI(true); show("game"); buildStrip();
  }
  if (G.rounds.length !== s.n) { G.rounds = Array.from({ length: s.n }, () => null); buildStrip(); }
  s.results.forEach((r, i) => { G.rounds[i] = G.rounds[i] || { id: r.id, t: r.t, start: [0, 0, .5] }; });
  if (s.round) G.rounds[s.idx] = s.round;
  G.results = s.results.map(r => ({ id: r.id, t: r.t, truth: r.truth, guess: r.me && r.me.hex, d: r.me ? r.me.d : null, pts: r.me ? r.me.pts : 0 }));
  G.results.forEach((r, i) => paintChip(i, r));
  $("runTotal").textContent = s.me.total;
  $("hudMode").textContent = `Duel, manche ${s.idx + 1} sur ${s.n}`;

  if (s.phase === "play") {
    if (D.roundKey !== key) { D.roundKey = key; D.sent = false; startRound(); }
    const sent = D.sent || !!s.myGuess;
    if (sent && G.phase === "guess") showWaiting(s.myGuess || cur());
  } else if (D.revealKey !== key) {
    D.revealKey = key; duelReveal(s);
  }
  updateDuelBar(s);
}

function updateDuelBar(s) {
  const fill = (el, name, p, isMe) => {
    el.querySelector(".who").textContent = name;
    el.querySelector(".pts").textContent = p ? p.total : 0;
    const st = el.querySelector(".state");
    let txt = "", done = false;
    if (!p) txt = "a quitté la salle";
    else if (!p.online && !isMe) txt = "déconnecté";
    else if (s.phase === "play") { done = p.submitted || (isMe && (D.sent || !!s.myGuess)); txt = done ? "a validé" : "réfléchit…"; }
    else txt = "";
    st.textContent = txt; st.classList.toggle("done", done);
  };
  fill($("dbMe"), "Toi", s.me, true);
  fill($("dbOpp"), s.opp ? s.opp.name : "Adversaire", s.opp, false);
  const a = s.me.total, b = s.opp ? s.opp.total : 0;
  $("dbMe").classList.toggle("lead", a > b); $("dbOpp").classList.toggle("lead", b > a);
}

function showWaiting(hex) {
  $("guessPanel").hidden = true; $("revealPanel").hidden = true; $("waitPanel").hidden = false;
  $("waitSwatch").style.background = hex;
  $("waitText").textContent = `Couleur envoyée. En attente de ${oppName()}…`;
  $("flagHint").textContent = "";
}

async function duelSubmit() {
  if (!D || !D.s || D.s.phase !== "play" || D.sent) return;
  D.sent = true;
  const hex = cur();
  showWaiting(hex);
  try { await duelAction("guess", { round: D.s.idx, hex }); }
  catch (e) { $("waitText").textContent = e.message; }
}

function duelReveal(s) {
  const r = s.results[s.idx], me = r.me || { hex: null, pts: 0 }, op = r.opp;
  G.phase = "result"; G.showMine = false; G.t = r.t;
  $("guessPanel").hidden = true; $("waitPanel").hidden = true; $("revealPanel").hidden = false;
  $("verdict").textContent = me.hex ? verdict(me.d) : "Temps écoulé";
  $("delta").textContent = me.hex ? `Écart de ${dec(me.d)} (ΔE 2000)` : "Aucune couleur envoyée à temps.";
  const ink = hex => (F.lab(hex)[0] > 60 ? "#1c1c1c" : "#ffffff");
  const cell = (id, hex, label) => {
    const el = $(id); el.classList.toggle("none", !hex);
    el.style.background = hex || ""; el.style.color = hex ? ink(hex) : "";
    el.querySelector("span").textContent = label; el.querySelector("b").textContent = hex || "Rien";
  };
  cell("splitYou", me.hex, "Ta couleur");
  cell("splitOpp", op && op.hex, s.opp ? s.opp.name : "Adversaire");
  cell("splitTrue", r.truth, "La vraie");
  const opPts = op ? op.pts : 0;
  const who = me.pts > opPts ? "Manche pour toi." : me.pts < opPts ? `Manche pour ${esc(oppName())}.` : "Égalité sur cette manche.";
  $("oppLine").innerHTML = `${esc(oppName())} : <b>+${opPts}</b>${op && op.hex ? `, écart de ${dec(op.d)}` : ", temps écoulé"}. ${who}`;
  countUp($("gain"), me.pts);
  $("flag").classList.toggle("clickable", !!me.hex);
  $("flagHint").textContent = me.hex ? "Touche le drapeau pour comparer avec ta version." : "";
  renderFlag();
}

function duelTick() {
  if (!D || !D.s) return;
  const s = D.s, ms = left();
  if (s.phase === "countdown") {
    $("lobbyStatus").textContent = `Départ dans ${Math.max(1, Math.ceil(ms / 1000))}`;
  } else if (s.phase === "play") {
    $("hudTime").textContent = fmtTime(Math.max(0, ms) + 999);
    $("hudTime").classList.toggle("urgent", ms < 10000);
    if (ms <= 250 && !D.sent && !s.myGuess && G.phase === "guess") duelSubmit();
  } else if (s.phase === "reveal") {
    $("hudTime").textContent = ""; $("hudTime").classList.remove("urgent");
    const n = Math.max(0, Math.ceil(ms / 1000));
    $("autoNext").textContent = s.idx + 1 < s.n ? `Manche suivante dans ${n} s` : `Résultats dans ${n} s`;
  }
}

function renderDuelEnd(s) {
  const key = `${s.game}`;
  if (current !== "duelEnd") { show("duelEnd"); $("deStatus").textContent = ""; }
  G.mode = "duel"; G.phase = "done";
  const oppTotal = s.opp ? s.opp.total : s.results.reduce((a, r) => a + (r.opp ? r.opp.pts : 0), 0);
  const oName = s.opp ? s.opp.name : (s.forfeit || "Adversaire");
  $("deTitle").textContent = s.forfeit ? "Victoire par forfait" : s.winner === "me" ? "Victoire" : s.winner === "opp" ? "Défaite" : "Égalité";
  $("deMeName").textContent = "Toi"; $("deMe").textContent = s.me.total;
  $("deOppName").textContent = oName; $("deOpp").textContent = oppTotal;
  $("drOpp").textContent = oName;
  $("deSub").textContent = s.forfeit ? `${s.forfeit} a quitté la salle avant la fin.`
    : s.tiebreak ? "Égalité de points : départagés par le temps de réponse."
    : `${plural(s.n, "manche", "manches")} en niveau ${LEVEL_NAME[s.level] || "moyen"}, sur les mêmes drapeaux.`;
  document.querySelector(".duel-recap-wrap").hidden = !s.results.length;
  if (D.endKey !== key) {
    D.endKey = key;
    $("deRecap").innerHTML = s.results.map(r => {
      const f = F.BY_ID[r.id], [w, h] = fitSize(f, 36, 24);
      const a = r.me ? r.me.pts : 0, b = r.opp ? r.opp.pts : 0;
      const c = (x, win) => `<span class="c${win ? " win" : ""}">${x && x.hex ? `<i style="background:${x.hex}"></i>` : `<i class="none"></i>`}<b>${x ? x.pts : 0}</b></span>`;
      return `<li><span class="fl">${F.flagSVG(f, k => f.c[k], w, h)}<span>${esc(f.n)}</span></span>${c(r.me, a > b)}${c(r.opp, b > a)}<span class="c"><i style="background:${r.truth}"></i></span></li>`;
    }).join("");
  }
  const rb = $("deRematch");
  if (!s.opp) { rb.disabled = true; rb.textContent = "Revanche"; $("deStatus").textContent = `${oName} n'est plus dans la salle.`; }
  else {
    rb.disabled = false;
    rb.textContent = s.me.ready ? "Annuler la revanche" : "Revanche";
    rb.classList.toggle("primary", !s.me.ready);
    $("deStatus").textContent = s.opp.ready && s.me.ready ? "" : s.opp.ready ? `${s.opp.name} veut sa revanche !`
      : s.me.ready ? `En attente de ${s.opp.name}…` : (!s.opp.online ? `${s.opp.name} est déconnecté.` : "");
  }
}

function duelShareText() {
  const s = D.s, sq = p => (p >= 90 ? "🟩" : p >= 70 ? "🟨" : p >= 40 ? "🟧" : "🟥");
  const oName = s.opp ? s.opp.name : (s.forfeit || "Adversaire");
  const oppTotal = s.results.reduce((a, r) => a + (r.opp ? r.opp.pts : 0), 0);
  return `La bonne couleur, duel\n${getName() || "Moi"} ${s.me.total} – ${oppTotal} ${oName}\n${s.results.map(r => sq(r.me ? r.me.pts : 0)).join("")}\n${location.origin}`;
}

$("duelCreate").addEventListener("click", duelCreate);
$("joinForm").addEventListener("submit", e => { e.preventDefault(); duelJoin($("joinCode").value); });
$("joinCode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
$("readyBtn").addEventListener("click", async () => {
  if (!D || !D.s) return;
  try { await duelAction(D.s.me.ready ? "unready" : "ready"); } catch (e) { $("lobbyStatus").textContent = e.message; }
});
$("duelLevel").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b || b.disabled || !D) return;
  try { await duelAction("config", { level: b.dataset.level }); } catch (err) { $("lobbyStatus").textContent = err.message; }
});
$("roundsPick").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b || b.disabled || !D) return;
  try { await duelAction("config", { rounds: +b.dataset.n }); } catch (err) { $("lobbyStatus").textContent = err.message; }
});
$("copyInvite").addEventListener("click", async () => {
  const url = $("inviteLink").value;
  try { await navigator.clipboard.writeText(url); $("inviteHint").textContent = "Lien copié. Envoie-le à ton adversaire."; }
  catch { $("inviteLink").select(); $("inviteHint").textContent = "Sélectionne le lien et copie-le."; }
});
$("lobbyLeave").addEventListener("click", duelLeave);
$("deLeave").addEventListener("click", duelLeave);
$("deRematch").addEventListener("click", async () => {
  if (!D || !D.s) return;
  try { await duelAction(D.s.me.ready ? "unready" : "ready"); } catch (e) { $("deStatus").textContent = e.message; }
});
$("deShare").addEventListener("click", async () => {
  const text = duelShareText();
  try { await navigator.clipboard.writeText(text); $("deStatus").textContent = "Résultat copié."; }
  catch { $("deStatus").textContent = text; }
});

/* Arrivée par un lien d'invitation (?salle=CODE) ou retour dans une salle ouverte */
function openFromUrl() {
  const code = (new URLSearchParams(location.search).get("salle") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!code) return;
  const saved = LS.get("bc.duel");
  if (saved && saved.code === code) return enterRoom(saved.code, saved.key);
  $("joinCode").value = code;
  if (getName().length >= 2) return duelJoin(code);
  duelError(`Tu es invité dans la salle ${code}. Choisis un pseudo puis clique sur « Rejoindre ».`);
  $("name").focus();
}

/* ---------- Démarrage ---------- */
buildFan();
refreshHome();
openFromUrl();
})();
