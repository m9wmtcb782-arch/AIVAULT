// LOCAL load test: provision 1,000 accounts (agent_no 101..1100, PLACEHOLDER pinyin) and extrapolate to 100k.
import { StalwartProvider, provisionAgent } from "../src/stalwart-provider.mjs";
import { EncryptedMemoryVault } from "../src/vault.mjs";
import { execSync } from "node:child_process"; import { writeFileSync } from "node:fs";
const sp = new StalwartProvider({ baseUrl: process.env.STALWART_URL, adminAuth: process.env.STALWART_ADMIN, domain: "aivault.net.eu.org" });
const vault = new EncryptedMemoryVault();
const du = () => Number(execSync("du -sb /opt/stalwart/data | cut -f1").toString().trim());
const rss = () => Number(execSync("ps -o rss= -p $(pgrep -f 'stalwart --config' | head -1)").toString().trim()) * 1024;
const before = { accounts: await sp.countAccounts(), disk: du(), rss: rss() };
const CONC = Number(process.env.CONC || 8), N = 1000; let next = 101, fails = 0; const lat = [];
const t0 = Date.now();
await Promise.all(Array.from({ length: CONC }, async () => { while (next < 101 + N) { const n = next++; const s = Date.now();
  try { await provisionAgent({ agent: { agent_no: n, agent_id: `Worker-${n}`, pinyin: "loadtest", placeholder: true }, provider: sp, vault }); } catch { fails++; } lat.push(Date.now() - s); } }));
const ms = Date.now() - t0; await new Promise(r => setTimeout(r, 2000));
const after = { accounts: await sp.countAccounts(), disk: du(), rss: rss() };
lat.sort((a, b) => a - b);
const perSec = N / (ms / 1000), diskPer = (after.disk - before.disk) / N;
const out = { label: "LOCAL", at: new Date().toISOString(), concurrency: CONC, provisioned: N - fails, fails, ms, perSec: +perSec.toFixed(1),
  p50: lat[Math.floor(N * .5)], p95: lat[Math.floor(N * .95)], before, after, diskBytesPerEmptyAccount: Math.round(diskPer),
  extrapolate100k: { provisionMinutes: +((100000 / perSec) / 60).toFixed(1), emptyAccountDiskMB: +((diskPer * 100000) / 1048576).toFixed(0),
    note: "Empty accounts only; mail storage dominates in real use (quota 256MB/account default → worst case 25.6TB at 100k; set realistic quota)." },
  host: { cpus: execSync("nproc").toString().trim(), memTotalMB: Math.round(Number(execSync("awk '/MemTotal/{print $2}' /proc/meminfo")) / 1024) } };
writeFileSync(new URL("../evidence/stalwart-load-1000.json", import.meta.url), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
