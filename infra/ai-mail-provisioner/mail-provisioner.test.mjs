import test from "node:test";
import assert from "node:assert/strict";
import {identityCode,makeMailboxCandidate,provisionMailbox,generatePassword} from "./mail-provisioner.mjs";
test("identity codes",()=>{
  for(const [n,s] of [[1,"1U"],[99,"9T9U"],[100,"1H"],[1000,"1K"],[10000,"1W"],[12345,"1W2K3H4T5U"],[99999,"9W9K9H9T9U"],[100000,"10W"]]) assert.equal(identityCode(n),s);
});
test("AI 001 dry run never creates mailbox",async()=>{
  let called=false;
  const x=await provisionMailbox({agentId:"Worker-001",number:1,romanizedName:"linganan",domain:"example.org"},{provider:{createMailbox(){called=true;} }});
  assert.equal(x.email,"linganan1u@example.org");assert.equal(x.created,false);assert.equal(called,false);
});
test("real mode requires owner authorization",async()=>{
  await assert.rejects(()=>provisionMailbox({agentId:"Worker-001",number:1,romanizedName:"linganan",domain:"example.org"},{dryRun:false}),/OWNER_APPROVAL_REQUIRED/);
});
test("password has sufficient randomness",()=>assert.ok(generatePassword().length>=40));
