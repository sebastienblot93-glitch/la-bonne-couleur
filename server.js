/*
 * La bonne couleur — serveur (Node, sans dépendance).
 * Sert le dossier public/ et une petite API :
 *   GET  /api/game?mode=daily|free      → nouvelle partie (jeton signé + manches)
 *   POST /api/score                     → enregistre une partie, recalcule le score côté serveur
 *   GET  /api/leaderboard?board=daily|free[&pid=]
 *   GET  /api/stats
 *   /api/duel/*                         → duels en temps réel (voir duel.js)
 *   GET  /healthz
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Flags = require("./public/flags.js");
const { createStore } = require("./store.js");

const PORT = process.env.PORT || 10000;
const ROOT = path.join(__dirname, "public");
const SECRET = process.env.GAME_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.GAME_SECRET) console.warn("GAME_SECRET absent : secret temporaire (les parties en cours seront invalidées au redémarrage).");
const store = createStore();

const TOKEN_MAX_AGE = 6 * 3600 * 1000;   // une partie doit être rendue dans les 6 h
const MIN_DURATION = +process.env.MIN_DURATION_MS || 8000; // moins de 8 s pour 10 manches : refusé
const TOP_N = 50;

/* ---------- Utilitaires ---------- */
const b64 = s => Buffer.from(s).toString("base64url");
const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
const parisDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function makeToken(payload) { const body = b64(JSON.stringify(payload)); return `${body}.${sign(body)}`; }
function readToken(token) {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  try { return { payload: JSON.parse(Buffer.from(body, "base64url").toString()), sig }; } catch { return null; }
}

function cleanName(raw) {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}
const validPid = p => typeof p === "string" && /^[a-f0-9-]{36}$/i.test(p);
const composite = (total, ms) => total * 1e5 + (99999 - Math.min(99999, Math.floor(ms / 100)));

/* ---------- Limitation de débit (par IP, par minute) ---------- */
const hits = new Map();
function limited(req, bucket, max) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const key = bucket + "|" + ip, now = Date.now();
  let h = hits.get(key);
  if (!h || h.reset < now) { h = { n: 0, reset: now + 60000 }; hits.set(key, h); }
  h.n++;
  return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60000).unref();

/* ---------- Réponses ---------- */
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data: blob:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'",
  ].join("; "),
};
function json(res, status, obj) {
  res.writeHead(status, { ...SECURITY, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
const fail = (res, status, message) => json(res, status, { error: message });

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > limit) { reject(new Error("too_big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new Error("bad_json")); } });
    req.on("error", reject);
  });
}

/* ---------- API ---------- */
async function apiGame(req, res, url) {
  if (limited(req, "game", 40)) return fail(res, 429, "Trop de parties lancées, réessaie dans une minute.");
  const mode = url.searchParams.get("mode") === "daily" ? "daily" : "free";
  const date = parisDate();
  const seed = mode === "daily" ? sign("daily:" + date).slice(0, 16) : crypto.randomBytes(9).toString("base64url");
  const payload = { v: 1, m: mode, d: date, s: seed, iat: Date.now(), n: crypto.randomBytes(6).toString("base64url") };
  json(res, 200, { token: makeToken(payload), mode, date, rounds: Flags.generate(seed) });
}

async function apiScore(req, res) {
  if (limited(req, "score", 20)) return fail(res, 429, "Trop d'envois, réessaie dans une minute.");
  let body;
  try { body = await readBody(req); } catch { return fail(res, 400, "Requête illisible."); }
  const tok = readToken(body.token);
  if (!tok || tok.payload.v !== 1) return fail(res, 400, "Partie inconnue.");
  const { m: mode, d: date, s: seed, iat } = tok.payload;
  const elapsed = Date.now() - iat;
  if (elapsed > TOKEN_MAX_AGE) return fail(res, 410, "Cette partie a expiré.");
  if (elapsed < MIN_DURATION) return fail(res, 400, "Partie terminée trop vite pour être enregistrée.");
  const name = cleanName(body.name);
  if (name.length < 2) return fail(res, 400, "Choisis un pseudo d'au moins 2 caractères.");
  if (!validPid(body.pid)) return fail(res, 400, "Identifiant de joueur invalide.");
  const guesses = body.guesses;
  if (!Array.isArray(guesses) || guesses.length !== Flags.ROUNDS || !guesses.every(Flags.isHex)) return fail(res, 400, "Réponses incomplètes.");

  // Le score est recalculé ici à partir de la graine : le client ne peut pas l'imposer.
  const rounds = Flags.generate(seed).map((r, i) => {
    const truth = Flags.BY_ID[r.id].c[r.t], d = Flags.dE(guesses[i].toUpperCase(), truth);
    return { id: r.id, truth, guess: guesses[i].toUpperCase(), d: +d.toFixed(2), pts: Flags.points(d) };
  });
  const total = rounds.reduce((a, r) => a + r.pts, 0);

  if (!(await store.useToken(tok.sig, 7 * 24 * 3600))) return fail(res, 409, "Cette partie a déjà été enregistrée.");

  const board = mode === "daily" ? "daily:" + date : "free";
  const info = { name, total, ms: elapsed, at: Date.now(), p: rounds.map(r => r.pts) };
  const { stored } = await store.record(board, body.pid, composite(total, elapsed), info, mode === "daily" ? "nx" : "gt");
  await store.incr("games");
  const [me, count] = await Promise.all([store.rank(board, body.pid), store.count(board)]);
  json(res, 200, { total, ms: elapsed, rounds, mode, date, board: mode, stored, already: mode === "daily" && !stored, me: me && { rank: me.rank, ...me.info }, count });
}

async function apiLeaderboard(req, res, url) {
  if (limited(req, "lb", 120)) return fail(res, 429, "Trop de requêtes, réessaie dans une minute.");
  const kind = url.searchParams.get("board") === "free" ? "free" : "daily";
  const date = parisDate();
  const board = kind === "daily" ? "daily:" + date : "free";
  const pid = url.searchParams.get("pid");
  const [top, count, me] = await Promise.all([
    store.top(board, TOP_N), store.count(board), validPid(pid) ? store.rank(board, pid) : null,
  ]);
  json(res, 200, {
    board: kind, date, count,
    entries: top.map((e, i) => ({ rank: i + 1, name: e.info?.name || "?", total: e.info?.total ?? 0, ms: e.info?.ms ?? 0, p: e.info?.p || [], me: e.pid === pid })),
    me: me && { rank: me.rank, name: me.info?.name, total: me.info?.total, ms: me.info?.ms, p: me.info?.p || [] },
  });
}

async function apiStats(req, res) {
  const date = parisDate();
  const [games, today, nDuels] = await Promise.all([store.get("games"), store.count("daily:" + date), store.get("duels")]);
  json(res, 200, { games, today, duels: nDuels, date });
}

const duels = require("./duel.js")({ Flags, json, fail, readBody, limited, cleanName, validPid, store });

/* ---------- Fichiers statiques ---------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};
function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return fail(res, 400, "Adresse invalide."); }
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return fail(res, 403, "Interdit.");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { ...SECURITY, "Content-Type": "text/plain; charset=utf-8" }); return res.end("Page introuvable"); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { ...SECURITY, "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

/* ---------- Routage ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/healthz") { const ok = await store.ping().catch(() => false); return json(res, 200, { ok: true, store: store.kind, storeReady: ok }); }
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/game" && req.method === "GET") return await apiGame(req, res, url);
      if (url.pathname === "/api/score" && req.method === "POST") return await apiScore(req, res);
      if (url.pathname === "/api/leaderboard" && req.method === "GET") return await apiLeaderboard(req, res, url);
      if (url.pathname === "/api/stats" && req.method === "GET") return await apiStats(req, res);
      if (url.pathname.startsWith("/api/duel/") && await duels(req, res, url)) return;
      return fail(res, 404, "Route inconnue.");
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 503, "Le classement est momentanément indisponible.");
  }
});

server.listen(PORT, () => console.log(`La bonne couleur : http://localhost:${PORT}`));
