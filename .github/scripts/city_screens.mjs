// 用 iPhone 14 視窗截公開頁；FROZEN CITY ?bench=1 會等 12 秒讀 window.__bench（軟體 WebGL，只當流程測試，不代表 iPhone 實際 FPS）。
import { chromium, devices } from "playwright"; import fs from "fs";
const BASE = "https://m9wmtcb782-arch.github.io/AIVAULT/"; fs.mkdirSync("shots", { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] }); const ctx = await b.newContext({ ...devices["iPhone 14"] });
for (const p of (process.env.PAGES || "").split(/\s+/).filter(Boolean)) { const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
  try { await pg.goto(BASE + p, { waitUntil: "networkidle", timeout: 45000 }); await pg.waitForTimeout(/bench=1/.test(p) ? 13000 : 4000);
    if (/cls=1/.test(p)) { await pg.waitForTimeout(8000); const n = await pg.evaluate(() => { try { window.__classroom.look(); return Object.keys(window.__classroom.live()).length; } catch (e) { return "no-classroom " + e.message; } }); await pg.waitForTimeout(25000); console.log("CLASSROOM live", n); }
    const bench = await pg.evaluate(() => window.__bench || null); const f = "shots/" + p.replace(/[^\w.-]+/g, "_") + ".png"; await pg.screenshot({ path: f });
    console.log("SHOT", p, "errors=" + errs.length, bench ? "bench fps_avg=" + bench.fps_avg + " low=" + bench.fps_1pct_low + " draws=" + bench.draw_calls : ""); if (errs.length) console.log("  pageerror:", errs.slice(0, 3).join(" | "));
  } catch (e) { console.log("FAIL", p, String(e.message).slice(0, 120)); } await pg.close(); }
await b.close();
