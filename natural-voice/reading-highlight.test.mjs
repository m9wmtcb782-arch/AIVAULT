import test from "node:test";
import assert from "node:assert/strict";
import {codePointRangeToUtf16} from "./reading-highlight.mjs";

test("Mandarin clause ranges preserve exact characters",()=>{
 assert.deepEqual(codePointRangeToUtf16("你好。再見。",3,6),{start:3,end:6});
});
test("emoji before clause does not shift highlighted text",()=>{
 const text="🐳你好。暗星說話。";
 const range=codePointRangeToUtf16(text,4,9);
 assert.equal(text.slice(range.start,range.end),"暗星說話。");
});
test("rejects out-of-bounds or malformed ranges",()=>{
 assert.equal(codePointRangeToUtf16("你好",0,3),null);
 assert.equal(codePointRangeToUtf16("你好",2,1),null);
 assert.equal(codePointRangeToUtf16("你好",-1,1),null);
});
