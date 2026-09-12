/* Node acceptance for AIVAULT Collaboration Core v0.2 */
var fs = require("fs");
var path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
eval(src);
if (!global.AIVAULT_COLLAB) {
  console.error("FAIL engine missing");
  process.exit(1);
}
var log = new global.AIVAULT_COLLAB.Engine(new global.AIVAULT_COLLAB.MemoryAdapter()).runAcceptance();
var fail = 0;
log.forEach(function (row) {
  console.log((row.ok ? "PASS" : "FAIL") + "  " + row.name + "  " + row.detail);
  if (!row.ok) fail += 1;
});
console.log("RESULT " + (log.length - fail) + "/" + log.length);
process.exit(fail ? 1 : 0);
