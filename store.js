/*
 * Stockage du classement.
 * - Si REDIS_URL est défini (Render Key Value, Redis, Valkey) : client RESP minimal, sans dépendance.
 * - Sinon : stockage en mémoire, sauvegardé dans data/store.json (pratique en local).
 */
"use strict";
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------ */
/* Client Redis (protocole RESP2)                                       */
/* ------------------------------------------------------------------ */
class RedisError extends Error {}

function encode(args) {
  let out = `*${args.length}\r\n`;
  for (const a of args) { const s = String(a); out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`; }
  return out;
}

function parse(buf, i) {
  if (i >= buf.length) return null;
  const end = buf.indexOf("\r\n", i);
  if (end < 0) return null;
  const type = String.fromCharCode(buf[i]);
  const line = buf.toString("utf8", i + 1, end);
  switch (type) {
    case "+": return [line, end + 2];
    case "-": return [new RedisError(line), end + 2];
    case ":": return [parseInt(line, 10), end + 2];
    case "$": {
      const n = parseInt(line, 10);
      if (n < 0) return [null, end + 2];
      if (buf.length < end + 2 + n + 2) return null;
      return [buf.toString("utf8", end + 2, end + 2 + n), end + 4 + n];
    }
    case "*": {
      const n = parseInt(line, 10);
      if (n < 0) return [null, end + 2];
      const arr = []; let p = end + 2;
      for (let k = 0; k < n; k++) { const r = parse(buf, p); if (!r) return null; arr.push(r[0]); p = r[1]; }
      return [arr, p];
    }
    default: throw new RedisError("Réponse Redis inattendue : " + type);
  }
}

class Redis {
  constructor(url) {
    const u = new URL(url);
    this.host = u.hostname; this.port = +u.port || 6379; this.tls = u.protocol === "rediss:";
    this.user = decodeURIComponent(u.username || ""); this.pass = decodeURIComponent(u.password || "");
    this.db = +(u.pathname || "/0").slice(1) || 0;
    this.sock = null; this.queue = []; this.buf = Buffer.alloc(0); this.backoff = 250;
  }
  connect() {
    const sock = this.tls
      ? tls.connect({ host: this.host, port: this.port, servername: this.host })
      : net.connect(this.port, this.host);
    this.sock = sock; this.buf = Buffer.alloc(0);
    sock.setNoDelay(true);
    sock.setKeepAlive(true, 30000);
    sock.on(this.tls ? "secureConnect" : "connect", () => { this.backoff = 250; });
    sock.on("data", d => this.onData(d));
    sock.on("error", e => console.error("[redis]", e.message));
    sock.on("close", () => {
      const pending = this.queue; this.queue = [];
      pending.forEach(p => p.rej(new RedisError("Connexion Redis fermée")));
      if (this.sock === sock) this.sock = null;
    });
    // Commandes d'initialisation, mises en file avant toute autre
    const init = [];
    if (this.pass) init.push(this.user ? ["AUTH", this.user, this.pass] : ["AUTH", this.pass]);
    if (this.db) init.push(["SELECT", this.db]);
    for (const c of init) {
      this.queue.push({ res: () => {}, rej: () => {}, init: true });
      sock.write(encode(c));
    }
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    let pos = 0;
    for (;;) {
      let r;
      try { r = parse(this.buf, pos); } catch (e) { this.sock && this.sock.destroy(e); return; }
      if (!r) break;
      pos = r[1];
      const p = this.queue.shift();
      if (!p) continue;
      if (r[0] instanceof RedisError) { if (p.init) console.error("[redis] init :", r[0].message); p.rej(r[0]); }
      else p.res(r[0]);
    }
    this.buf = this.buf.subarray(pos);
  }
  cmd(...args) {
    return new Promise((res, rej) => {
      if (!this.sock || this.sock.destroyed) this.connect();
      const sock = this.sock;
      const timer = setTimeout(() => { rej(new RedisError("Délai Redis dépassé")); sock.destroy(); }, 5000);
      this.queue.push({ res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); } });
      sock.write(encode(args));
    });
  }
}

/* ------------------------------------------------------------------ */
/* Interface commune                                                   */
/*  record(board, pid, score, info, mode)  mode = "nx" (1re fois) | "gt" (si meilleur) */
/*  top(board, n) · rank(board, pid) · count(board)                    */
/*  useToken(id, ttl) · incr(key) · get(key)                           */
/* ------------------------------------------------------------------ */
const DAILY_TTL = 45 * 24 * 3600;

function redisStore(url) {
  const r = new Redis(url);
  const lb = b => `lb:${b}`, li = b => `lbi:${b}`;
  return {
    kind: "redis",
    async ping() { return (await r.cmd("PING")) === "PONG"; },
    async record(board, pid, score, info, mode) {
      const res = mode === "nx"
        ? await r.cmd("ZADD", lb(board), "NX", score, pid)
        : await r.cmd("ZADD", lb(board), "GT", "CH", score, pid);
      const stored = res === 1;
      if (stored) await r.cmd("HSET", li(board), pid, JSON.stringify(info));
      if (board.startsWith("daily:")) { await r.cmd("EXPIRE", lb(board), DAILY_TTL); await r.cmd("EXPIRE", li(board), DAILY_TTL); }
      return { stored };
    },
    async top(board, n) {
      const flat = await r.cmd("ZREVRANGE", lb(board), 0, n - 1, "WITHSCORES");
      const pids = []; const scores = [];
      for (let i = 0; i < flat.length; i += 2) { pids.push(flat[i]); scores.push(+flat[i + 1]); }
      if (!pids.length) return [];
      const infos = await r.cmd("HMGET", li(board), ...pids);
      return pids.map((pid, i) => ({ pid, score: scores[i], info: safeJSON(infos[i]) }));
    },
    async rank(board, pid) {
      const rk = await r.cmd("ZREVRANK", lb(board), pid);
      if (rk === null) return null;
      const [score, info] = await Promise.all([r.cmd("ZSCORE", lb(board), pid), r.cmd("HGET", li(board), pid)]);
      return { rank: rk + 1, score: +score, info: safeJSON(info) };
    },
    async count(board) { return r.cmd("ZCARD", lb(board)); },
    async useToken(id, ttl) { return (await r.cmd("SET", `tok:${id}`, "1", "NX", "EX", ttl)) === "OK"; },
    async incr(key) { return r.cmd("INCR", `stat:${key}`); },
    async get(key) { return +(await r.cmd("GET", `stat:${key}`)) || 0; },
  };
}

function memoryStore(file) {
  let data = { boards: {}, tokens: {}, stats: {} };
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* premier lancement */ }
  let t = 0;
  const save = () => { clearTimeout(t); t = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); }
    catch (e) { console.error("[store]", e.message); } }, 300); };
  const board = b => (data.boards[b] = data.boards[b] || {});
  const sorted = b => Object.entries(board(b)).sort((x, y) => y[1].score - x[1].score || (x[0] < y[0] ? 1 : -1));
  return {
    kind: "memory",
    async ping() { return true; },
    async record(b, pid, score, info, mode) {
      const cur = board(b)[pid];
      const stored = mode === "nx" ? !cur : (!cur || score > cur.score);
      if (stored) { board(b)[pid] = { score, info }; save(); }
      return { stored };
    },
    async top(b, n) { return sorted(b).slice(0, n).map(([pid, v]) => ({ pid, score: v.score, info: v.info })); },
    async rank(b, pid) {
      const list = sorted(b); const i = list.findIndex(([p]) => p === pid);
      return i < 0 ? null : { rank: i + 1, score: list[i][1].score, info: list[i][1].info };
    },
    async count(b) { return Object.keys(board(b)).length; },
    async useToken(id, ttl) {
      const now = Date.now();
      for (const [k, exp] of Object.entries(data.tokens)) if (exp < now) delete data.tokens[k];
      if (data.tokens[id]) return false;
      data.tokens[id] = now + ttl * 1000; save(); return true;
    },
    async incr(key) { data.stats[key] = (data.stats[key] || 0) + 1; save(); return data.stats[key]; },
    async get(key) { return data.stats[key] || 0; },
  };
}

function safeJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

function createStore() {
  const url = process.env.REDIS_URL;
  if (url) { console.log("Classement : Redis / Key Value"); return redisStore(url); }
  console.log("Classement : mémoire locale (data/store.json) — définis REDIS_URL pour un stockage partagé");
  return memoryStore(path.join(__dirname, "data", "store.json"));
}

module.exports = { createStore };
