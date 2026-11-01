// node tests/aivault-weather-nulls.test.mjs — 缺測值回 null（不補 0），前端顯示「無資料」
import { obsNum, tempC, windDir, windSpeed } from '../supabase/functions/aivault-weather/normalize.js';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
let bad = 0; const eq = (name, got, exp) => { const ok = Object.is(got, exp); console.log(ok ? 'ok  ' : 'FAIL', name, JSON.stringify(got)); if (!ok) bad++; };
for (const v of [-99, '-99', -999, '-9999', '', '  ', null, undefined, 'X', NaN]) { eq(`windSpeed(${JSON.stringify(v)})`, windSpeed(v), null); eq(`windDir(${JSON.stringify(v)})`, windDir(v), null); eq(`tempC(${JSON.stringify(v)})`, tempC(v), null); }
eq('windDir(990 風向不定)', windDir(990), null); eq('windSpeed(-1)', windSpeed(-1), null); eq('tempC(99)', tempC(99), null);
eq('windSpeed(0 真靜風)', windSpeed(0), 0); eq('windSpeed("1.7")', windSpeed('1.7'), 1.7); eq('windDir(0 北風)', windDir(0), 0); eq('windDir(180)', windDir('180'), 180); eq('tempC(-2.5)', tempC(-2.5), -2.5); eq('tempC("26.3")', tempC('26.3'), 26.3); eq('obsNum(5)', obsNum(5), 5);
// 前端：badge 文字
const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {}, location: { search: '' }, navigator: { userAgent: 'node' }, innerWidth: 1000, innerHeight: 800, document: { body: null, addEventListener() {} }, URLSearchParams, Intl, setTimeout, setInterval };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(dir, '..', 'aivault-collab-weather.js'), 'utf8'), ctx);
const bt = ctx.window.AIVAULT_weatherBadgeText, nz = ctx.window.AIVAULT_weatherNz;
eq('nz(null)', nz(null), null); eq('nz("")', nz(''), null); eq('nz(0)', nz(0), 0);
const t1 = bt({ condition: 'clear', temp_c: null, wind_speed_ms: null, wind_dir_deg: null });
eq('badge 缺測含「氣溫無資料」', t1.includes('氣溫無資料'), true); eq('badge 缺測含「風速無資料」', t1.includes('風速無資料'), true); eq('badge 缺測不含「0 m/s」', /\b0 m\/s/.test(t1), false); eq('badge 缺測不含「0°」', /\b0°/.test(t1), false);
const t2 = bt({ condition: 'clear', temp_c: 26.3, wind_speed_ms: 1.7, wind_dir_deg: null });
eq('badge 風向缺測', t2.includes('風向無資料') && t2.includes('1.7 m/s') && t2.includes('26.3°C'), true);
const t3 = bt({ condition: 'clear', temp_c: 20, wind_speed_ms: 0, wind_dir_deg: 0 });
eq('badge 真 0 值照實顯示', t3.includes('風 0 m/s') && t3.includes(' 0°'), true);
console.log(bad ? `${bad} FAIL` : 'ALL PASS'); process.exit(bad ? 1 : 0);
