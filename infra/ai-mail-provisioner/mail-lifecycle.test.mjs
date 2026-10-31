import test from "node:test";
import assert from "node:assert/strict";
import {runMailboxLifecycle,verifyMailbox} from "./mail-lifecycle.mjs";
test("dry-run never invokes provider",async()=>{
 let calls=0;
 const x=await runMailboxLifecycle({agentId:"ag-0001",email:"agent@example.org",provider:{createMailbox(){calls++}},dryRun:true});
 assert.equal(x.status,"DRY_RUN");assert.equal(calls,0);
});
test("provision and verify with fake authorized adapter",async()=>{
 let rec={};const events=[];
 const store={
  async get(){return rec},
  async setStatus(update){rec={...rec,...update}},
  async saveCredential({password}){assert.ok(password.length>=40);return "opaque-secret-ref"}
 };
 const provider={approved:true,costApproved:true,
  async createMailbox({password}){assert.ok(password.length>=40);return {mailboxId:"fake-1"}},
  async checkVerification(){return true},
  async sendTestMessage(){return {id:"test-1"}},
  async checkTestMessage(){return true}
 };
 const input={agentId:"ag-0001",email:"agent@example.org",provider,store,authorized:true,dryRun:false,audit:async x=>events.push(x)};
 assert.equal((await runMailboxLifecycle(input)).status,"PROVISIONED");
 assert.equal((await verifyMailbox(input)).status,"VERIFIED");
 assert.equal((await runMailboxLifecycle(input)).reused,true);
 assert.deepEqual(events.map(x=>x.event),["PROVISION_STARTED","PROVISIONED","VERIFIED"]);
});
test("refuse live provisioning without approval",async()=>{
 await assert.rejects(()=>runMailboxLifecycle({agentId:"ag-0001",email:"agent@example.org",dryRun:false}),/PROVIDER_NOT_APPROVED/);
});
