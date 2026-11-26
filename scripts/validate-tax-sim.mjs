import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sim = fs.readFileSync("ai-tax-scenario-sim.html", "utf8");
const hub = fs.readFileSync("ai-tax-law.html", "utf8");

const scripts = [...sim.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

assert.equal(scripts.length, 1, "scenario simulator should contain one inline application script");
for (const [index, source] of scripts.entries()) {
  new vm.Script(source, { filename: `ai-tax-scenario-sim.inline-${index + 1}.js` });
}

assert.equal((sim.match(/\\{id:\\d+, level:/g) || []).length, 22, "expected 22 scenario definitions");
assert.equal((sim.match(/^\\s+\\d+: \\{risk:/gm) || []).length, 22, "expected 22 alert rules");
for (const id of ["scList", "runBtn", "generateAlertsBtn", "exportAuditBtn", "clearAlertsBtn", "alertList"]) {
  assert.match(sim, new RegExp(`id=["']${id}["']`), `missing simulator element: ${id}`);
}
assert.match(sim, /aivault-tax-sim-alerts-v1/, "missing local alert persistence key");
assert.match(sim, /aivault-tax-sim-audit-v1/, "missing local audit persistence key");
assert.match(sim, /function escapeHTML\\(/, "missing HTML escaping function");
assert.match(sim, /rule_based_reassessment/, "missing rule-based reassessment audit event");
assert.match(hub, /href=["']ai-tax-scenario-sim\\.html["']/, "tax hub must link to the scenario workspace");
assert.match(hub, /AI稅務模擬專區/, "tax hub title must remain consistent");

console.log("PASS: inline JavaScript syntax");
console.log("PASS: 22 scenarios and 22 alert rules");
console.log("PASS: local persistence, audit export, reassessment and escaping");
console.log("PASS: tax hub entry link and title");
