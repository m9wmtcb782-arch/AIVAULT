// Fixed-window per-key limiter (in-memory; production backs it with agent_ops.permissions.daily_quota).
export class RateLimiter {
  constructor({ limit, windowMs, now = () => Date.now() }) { Object.assign(this, { limit, windowMs, now }); this.m = new Map(); }
  take(key) {
    const t = this.now(); let e = this.m.get(key);
    if (!e || t - e.start >= this.windowMs) { e = { start: t, n: 0 }; this.m.set(key, e); }
    if (e.n >= this.limit) return { ok: false, retryInMs: this.windowMs - (t - e.start) };
    e.n++; return { ok: true, remaining: this.limit - e.n };
  }
}
