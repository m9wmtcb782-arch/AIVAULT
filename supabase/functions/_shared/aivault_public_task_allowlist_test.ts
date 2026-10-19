import { strict as assert } from "node:assert";
import { createApprovedPublicTask } from "./aivault_public_task_allowlist.ts";
import { authorizeExternalEgress } from "./aivault_external_egress.ts";
Deno.test("static public task passes policy",()=>{
 const task=createApprovedPublicTask("PUBLIC_CONNECTIVITY_CHECK");
 assert.equal(task.prompt,"Reply with the single word OK.");
 assert.equal(authorizeExternalEgress(task.egress).allowed,true);
});
Deno.test("unregistered task ID is rejected",()=>{
 assert.throws(()=>createApprovedPublicTask("INTERNAL_DUMP" as never),/UNAPPROVED_PUBLIC_TASK/);
});
Deno.test("prototype properties are not valid task IDs",()=>{
 assert.throws(()=>createApprovedPublicTask("constructor" as never),/UNAPPROVED_PUBLIC_TASK/);
});
