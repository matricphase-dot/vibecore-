/**
 * cache.js — In-memory cache, drop-in replacement for Upstash Redis.
 * Supports: get, set (with TTL), del, incr, lpush, ltrim, lrange, smembers, sadd, pipeline.
 * Data is lost on server restart — acceptable for cache (it auto-repopulates).
 */

class MemoryCache {
  constructor() {
    this._kv    = new Map(); // key → { value, expiresAt }
    this._lists = new Map(); // key → Array
    this._sets  = new Map(); // key → Set

    // Purge expired KV entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [k, e] of this._kv.entries()) {
        if (e.expiresAt && now > e.expiresAt) this._kv.delete(k);
      }
    }, 5 * 60 * 1000).unref(); // .unref() so it doesn't block process exit
  }

  _expired(entry) {
    return entry.expiresAt && Date.now() > entry.expiresAt;
  }

  async get(key) {
    const e = this._kv.get(key);
    if (!e) return null;
    if (this._expired(e)) { this._kv.delete(key); return null; }
    return e.value;
  }

  async set(key, value, opts = {}) {
    const expiresAt = opts.ex ? Date.now() + opts.ex * 1000 : null;
    this._kv.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key) {
    const had = this._kv.delete(key) | this._lists.delete(key) | this._sets.delete(key);
    return had ? 1 : 0;
  }

  async incr(key) {
    const e = this._kv.get(key);
    const cur = (e && !this._expired(e)) ? (parseInt(e.value) || 0) : 0;
    const next = cur + 1;
    this._kv.set(key, { value: next, expiresAt: e?.expiresAt ?? null });
    return next;
  }

  async lpush(key, ...values) {
    if (!this._lists.has(key)) this._lists.set(key, []);
    const list = this._lists.get(key);
    list.unshift(...values.map(String));
    return list.length;
  }

  async ltrim(key, start, stop) {
    if (!this._lists.has(key)) return 'OK';
    const list = this._lists.get(key);
    const end = stop === -1 ? undefined : stop + 1;
    this._lists.set(key, list.slice(start, end));
    return 'OK';
  }

  async lrange(key, start, stop) {
    if (!this._lists.has(key)) return [];
    const list = this._lists.get(key);
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  async smembers(key) {
    return this._sets.has(key) ? Array.from(this._sets.get(key)) : [];
  }

  async sadd(key, ...members) {
    if (!this._sets.has(key)) this._sets.set(key, new Set());
    const s = this._sets.get(key);
    let added = 0;
    for (const m of members) { if (!s.has(m)) { s.add(m); added++; } }
    return added;
  }

  /** Minimal pipeline — supports get and set commands */
  pipeline() {
    const cmds = [];
    const pipe = {
      get:  (key)               => { cmds.push({ fn: 'get',  args: [key] });        return pipe; },
      set:  (key, val, opts)    => { cmds.push({ fn: 'set',  args: [key, val, opts || {}] }); return pipe; },
      exec: async ()            => Promise.all(cmds.map(c => this[c.fn](...c.args)))
    };
    return pipe;
  }

  /** Expose stats for health endpoint */
  stats() {
    return {
      kv_keys:   this._kv.size,
      list_keys: this._lists.size,
      set_keys:  this._sets.size
    };
  }
}

// Singleton — shared across the entire backend process
export const cache = new MemoryCache();
