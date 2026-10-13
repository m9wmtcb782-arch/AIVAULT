import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("./reading-sync-test.html",import.meta.url),"utf8");
test("mobile audiobook has independent play, pause, and stop controls",()=>{
 for(const id of ["play","pause","stop"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/context\.suspend\(\)/);
 assert.match(html,/context\.resume\(\)/);
 assert.match(html,/abort\?\.abort\(\)/);
});
test("mobile audiobook uses actual audio-clock highlighting and safe Unicode offsets",()=>{
 assert.match(html,/playback\.highlight/);
 assert.match(html,/codePointRangeToUtf16/);
 assert.match(html,/withMetadata:true/);
});
