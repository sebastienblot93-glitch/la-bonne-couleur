/*
 * Duels en temps réel, dans une salle à code.
 * Les salles vivent en mémoire du serveur (une seule instance sur Render) ;
 * chaque joueur reçoit l'état de la salle par un flux Server-Sent Events.
 *
 *   POST /api/duel/create   {pid, name}            → {code, key}
 *   POST /api/duel/join     {pid, name, code}      → {code, key}
 *   GET  /api/duel/stream?code&pid&key             → flux SSE « state »
 *   POST /api/duel/action   {code, pid, key, type, ...}
 *        type = ready | unready | config {rounds} | guess {hex, round} | leave
 *
 * Étapes d'une salle : lobby → countdown → play ⇄ reveal → end (→ countdown pour une revanche)
 */
"use strict";
const crypto = require("crypto");

const T = {
  countdown: +process.env.DUEL_COUNTDOWN_MS || 3500,
  round: +process.env.DUEL_ROUND_MS || 45000,
  reveal: +process.env.DUEL_REVEAL_MS || 6000,
  grace: 1500,                       // tolérance réseau après la fin du temps
};
const MAX_ROOMS = 500;
const IDLE_MS = 15 * 60 * 1000;      // salle supprimée après 15 min sans personne connecté
const MAX_AGE_MS = 4 * 3600 * 1000;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I/L

module.exports = function createDuels({ Flags, json, fail, readBody, limited, cleanName, validPid, store }) {
  const rooms = new Map();

  /* ---------- Outils ---------- */
  function newCode() {
    for (let k = 0; k < 50; k++) {
      let c = ""; const b = crypto.randomBytes(4);
      for (const x of b) c += ALPHABET[x % ALPHABET.length];
      if (!rooms.has(c)) return c;
    }
    return null;
  }
  const normCode = c => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : "");
  const newKey = () => crypto.randomBytes(18).toString("base64url");
  const keyOk = (p, key) => {
    if (!p || typeof key !== "string") return false;
    const a = Buffer.from(p.key), b = Buffer.from(key);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const players = room => [...room.players.values()].filter(p => !p.left);
  const other = (room, pid) => players(room).find(p => p.pid !== pid);
  const totalOf = (room, pid) => room.results.reduce((a, r) => a + (r[pid]?.pts || 0), 0);
  const timeOf = (room, pid) => room.results.reduce((a, r) => a + (r[pid]?.ms ?? T.round), 0);

  function makePlayer(pid, name) {
    return { pid, name, key: newKey(), ready: false, left: false, streams: new Set(), guesses: [], joinedAt: Date.now() };
  }

  function clearTimer(room) { clearTimeout(room.timer); room.timer = 0; }
  function schedule(room, ms, fn) { clearTimer(room); room.timer = setTimeout(fn, ms); }

  /* ---------- Vue envoyée à chaque joueur ---------- */
  function view(room, pid) {
    const me = room.players.get(pid), opp = other(room, pid);
    const pub = p => p && {
      name: p.name, online: p.streams.size > 0, ready: p.ready,
      submitted: room.phase === "play" && p.guesses[room.idx] != null,
      total: totalOf(room, p.pid),
    };
    const live = room.phase === "play" || room.phase === "reveal";
    let winner = null;
    if (room.phase === "end" && room.forfeit) winner = "me";
    else if (room.phase === "end" && opp) {
      const a = totalOf(room, pid), b = totalOf(room, opp.pid);
      winner = a !== b ? (a > b ? "me" : "opp") : (timeOf(room, pid) === timeOf(room, opp.pid) ? "tie" : (timeOf(room, pid) < timeOf(room, opp.pid) ? "me" : "opp"));
    }
    return {
      code: room.code, phase: room.phase, n: room.rounds, idx: room.idx, game: room.game,
      host: room.host === pid, deadline: room.deadline, now: Date.now(),
      round: live ? room.list[room.idx] : null,
      myGuess: live && me ? me.guesses[room.idx] || null : null,
      me: pub(me), opp: pub(opp) || null,
      results: room.results.map(r => ({ id: r.id, t: r.t, truth: r.truth, me: r[pid] || null, opp: opp ? r[opp.pid] || null : null })),
      winner, forfeit: room.phase === "end" ? room.forfeit || null : null,
      tiebreak: !!(winner && opp && totalOf(room, pid) === totalOf(room, opp.pid) && winner !== "tie"),
    };
  }

  function broadcast(room) {
    room.touched = Date.now();
    for (const p of room.players.values()) {
      if (!p.streams.size) continue;
      const data = `event: state\ndata: ${JSON.stringify(view(room, p.pid))}\n\n`;
      for (const res of p.streams) res.write(data);
    }
  }

  /* ---------- Déroulé ---------- */
  function maybeStart(room) {
    const ps = players(room);
    if ((room.phase === "lobby" || room.phase === "end") && ps.length === 2 && ps.every(p => p.ready)) {
      room.game++;
      room.seed = crypto.randomBytes(9).toString("base64url");
      room.list = Flags.generate(room.seed, room.rounds);
      room.results = []; room.idx = 0; room.forfeit = null;
      for (const p of room.players.values()) { p.guesses = []; p.ready = false; }
      room.phase = "countdown"; room.deadline = Date.now() + T.countdown;
      schedule(room, T.countdown, () => startRound(room, 0));
    }
    broadcast(room);
  }

  function startRound(room, i) {
    room.idx = i; room.phase = "play"; room.roundStart = Date.now(); room.deadline = room.roundStart + T.round;
    schedule(room, T.round + T.grace, () => endRound(room));
    broadcast(room);
  }

  function endRound(room) {
    if (room.phase !== "play") return;
    const r = room.list[room.idx], truth = Flags.BY_ID[r.id].c[r.t], res = { id: r.id, t: r.t, truth };
    for (const p of room.players.values()) {
      const g = p.guesses[room.idx];
      if (g) { const d = Flags.dE(g.hex, truth); res[p.pid] = { hex: g.hex, d: +d.toFixed(2), pts: Flags.points(d), ms: g.ms }; }
      else res[p.pid] = { hex: null, d: null, pts: 0, ms: T.round };
    }
    room.results.push(res);
    room.phase = "reveal"; room.deadline = Date.now() + T.reveal;
    schedule(room, T.reveal, () => {
      if (room.idx + 1 < room.rounds) startRound(room, room.idx + 1);
      else endGame(room);
    });
    broadcast(room);
  }

  function endGame(room) {
    clearTimer(room);
    room.phase = "end"; room.deadline = 0;
    store.incr("duels").catch(() => {});
    broadcast(room);
  }

  function removeRoom(room) {
    clearTimer(room);
    for (const p of room.players.values()) for (const res of p.streams) res.end();
    rooms.delete(room.code);
  }

  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const online = [...room.players.values()].some(p => p.streams.size);
      if ((!online && now - room.touched > IDLE_MS) || now - room.created > MAX_AGE_MS) removeRoom(room);
    }
  }, 60000).unref();

  // Battement régulier pour garder les flux ouverts derrière les proxys
  setInterval(() => {
    for (const room of rooms.values()) for (const p of room.players.values()) for (const res of p.streams) res.write(": ping\n\n");
  }, 20000).unref();

  /* ---------- Routes ---------- */
  async function body(req, res) {
    try { return await readBody(req); } catch { fail(res, 400, "Requête illisible."); return null; }
  }
  function checkIdentity(res, b) {
    const name = cleanName(b.name);
    if (!validPid(b.pid)) { fail(res, 400, "Identifiant de joueur invalide."); return null; }
    if (name.length < 2) { fail(res, 400, "Choisis un pseudo d'au moins 2 caractères."); return null; }
    return name;
  }

  async function create(req, res) {
    if (limited(req, "duel-create", 10)) return fail(res, 429, "Trop de salles créées, réessaie dans une minute.");
    const b = await body(req, res); if (!b) return;
    const name = checkIdentity(res, b); if (!name) return;
    if (rooms.size >= MAX_ROOMS) return fail(res, 503, "Trop de salles ouvertes en ce moment, réessaie plus tard.");
    const code = newCode(); if (!code) return fail(res, 503, "Impossible de créer une salle, réessaie.");
    const p = makePlayer(b.pid, name);
    const room = { code, host: b.pid, players: new Map([[b.pid, p]]), phase: "lobby", rounds: 5, idx: 0, list: [], results: [],
      deadline: 0, timer: 0, game: 0, created: Date.now(), touched: Date.now() };
    rooms.set(code, room);
    json(res, 200, { code, key: p.key });
  }

  async function join(req, res) {
    if (limited(req, "duel-join", 30)) return fail(res, 429, "Trop de tentatives, réessaie dans une minute.");
    const b = await body(req, res); if (!b) return;
    const name = checkIdentity(res, b); if (!name) return;
    const room = rooms.get(normCode(b.code));
    if (!room) return fail(res, 404, "Aucune salle avec ce code. Vérifie le code ou demande un nouveau lien.");
    const existing = room.players.get(b.pid);
    if (existing && !existing.left) { existing.name = name; broadcast(room); return json(res, 200, { code: room.code, key: existing.key }); }
    if (players(room).length >= 2) return fail(res, 409, "Cette salle est complète.");
    if (room.phase !== "lobby" && room.phase !== "end") return fail(res, 409, "Le duel a déjà commencé dans cette salle.");
    const p = makePlayer(b.pid, name);
    room.players.set(b.pid, p);
    if (room.phase === "end") { room.phase = "lobby"; room.results = []; room.forfeit = null; }
    if (!players(room).some(x => x.pid === room.host)) room.host = b.pid;
    broadcast(room);
    json(res, 200, { code: room.code, key: p.key });
  }

  function stream(req, res, url) {
    const room = rooms.get(normCode(url.searchParams.get("code")));
    const p = room && room.players.get(url.searchParams.get("pid"));
    if (!room || !p || p.left || !keyOk(p, url.searchParams.get("key"))) return fail(res, 404, "Salle introuvable.");
    if (p.streams.size >= 3) return fail(res, 429, "Trop de connexions ouvertes pour ce joueur.");
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write("retry: 2000\n\n");
    p.streams.add(res);
    broadcast(room);
    req.on("close", () => { p.streams.delete(res); if (rooms.has(room.code)) broadcast(room); });
  }

  async function action(req, res) {
    if (limited(req, "duel-action", 240)) return fail(res, 429, "Trop d'actions, ralentis un peu.");
    const b = await body(req, res); if (!b) return;
    const room = rooms.get(normCode(b.code));
    const p = room && room.players.get(b.pid);
    if (!room || !p || p.left || !keyOk(p, b.key)) return fail(res, 404, "Salle introuvable.");

    switch (b.type) {
      case "ready":
      case "unready":
        if (room.phase !== "lobby" && room.phase !== "end") return fail(res, 409, "Le duel est en cours.");
        p.ready = b.type === "ready";
        maybeStart(room);
        return json(res, 200, { ok: true });
      case "config": {
        if (room.phase !== "lobby" || room.host !== p.pid) return fail(res, 403, "Seul le créateur de la salle choisit le nombre de manches.");
        const n = +b.rounds;
        if (![5, 10].includes(n)) return fail(res, 400, "Nombre de manches invalide.");
        room.rounds = n;
        for (const x of room.players.values()) x.ready = false;
        broadcast(room);
        return json(res, 200, { ok: true });
      }
      case "guess": {
        if (room.phase !== "play" || +b.round !== room.idx) return fail(res, 409, "Cette manche est terminée.");
        if (Date.now() > room.deadline + T.grace) return fail(res, 409, "Temps écoulé pour cette manche.");
        if (!Flags.isHex(b.hex)) return fail(res, 400, "Couleur invalide.");
        if (p.guesses[room.idx]) return fail(res, 409, "Tu as déjà validé cette manche.");
        p.guesses[room.idx] = { hex: b.hex.toUpperCase(), ms: Math.min(T.round, Date.now() - room.roundStart) };
        const ps = players(room);
        if (ps.every(x => x.guesses[room.idx])) schedule(room, 500, () => endRound(room));
        broadcast(room);
        return json(res, 200, { ok: true });
      }
      case "leave": {
        p.left = true; p.ready = false;
        for (const s of p.streams) s.end();
        p.streams.clear();
        const rest = players(room);
        if (!rest.length) { removeRoom(room); return json(res, 200, { ok: true }); }
        if (room.host === p.pid) room.host = rest[0].pid;
        room.players.delete(p.pid);
        for (const x of rest) x.ready = false;
        if (room.phase === "countdown") { clearTimer(room); room.phase = "lobby"; }
        else if (room.phase === "play" || room.phase === "reveal") { clearTimer(room); room.phase = "end"; room.deadline = 0; room.forfeit = p.name; }
        else { room.phase = "lobby"; room.results = []; room.forfeit = null; }
        broadcast(room);
        return json(res, 200, { ok: true });
      }
      default:
        return fail(res, 400, "Action inconnue.");
    }
  }

  return async function handle(req, res, url) {
    const r = url.pathname;
    if (r === "/api/duel/create" && req.method === "POST") { await create(req, res); return true; }
    if (r === "/api/duel/join" && req.method === "POST") { await join(req, res); return true; }
    if (r === "/api/duel/stream" && req.method === "GET") { stream(req, res, url); return true; }
    if (r === "/api/duel/action" && req.method === "POST") { await action(req, res); return true; }
    return false;
  };
};
