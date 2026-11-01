// v2：動態信心（天時＝時間衰減；地利/人和＝task/model/district 相似度）＋疼痛反射（同類連續失敗→冷卻）。
export const W = { halfLifeH: Number(process.env.EXP_HALF_LIFE_H) || 72, painN: Number(process.env.EXP_PAIN_N) || 2, painWindowH: Number(process.env.EXP_PAIN_WINDOW_H) || 24, cooldownH: Number(process.env.EXP_COOLDOWN_H) || 24 };
export function contextSim(a = {}, b = {}) { let s = 0.5; if (a.task_type === b.task_type) s += 0.3; if (a.model && a.model === b.model) s += 0.1; if (a.district && a.district === b.district) s += 0.1; return s; }
// 由 append-only 結果事件即時計算（不改寫歷史）：每次成功 +1、失敗 -1，按時間衰減與情境相似度加權。
export function confidence(events, now, ctx = {}, w = W) {
  let pos = 0, neg = 0; for (const e of events) { const age = (now - e.t) / 3600e3; const k = Math.pow(0.5, age / w.halfLifeH) * contextSim(ctx, e.ctx); if (e.ok) pos += k; else neg += k; }
  return { pos, neg, conf: (pos - neg) / (pos + neg + 1) }; // -1（確定錯）…+1（確定對）
}
export function painCooldown(events, now, w = W) {
  const recent = events.filter((e) => !e.ok && (now - e.t) / 3600e3 <= w.painWindowH);
  if (recent.length < w.painN) return 0; const last = Math.max(...recent.map((e) => e.t)); const until = last + w.cooldownH * 3600e3;
  // 最後一次失敗之後若已有成功，解除
  return events.some((e) => e.ok && e.t > last) ? 0 : (until > now ? until : 0);
}
