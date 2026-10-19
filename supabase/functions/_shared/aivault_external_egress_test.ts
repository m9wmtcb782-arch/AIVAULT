import { strict as assert } from "node:assert";
import { authorizeExternalEgress, type EgressRequest } from "./aivault_external_egress.ts";
const base:EgressRequest={classification:"PUBLIC",purpose:"PUBLIC_QA",payload:"What is the capital of France?",approvedByPolicy:true};
Deno.test("public approved question allowed",()=>assert.equal(authorizeExternalEgress(base).allowed,true));
Deno.test("internal architecture blocked",()=>assert.equal(authorizeExternalEgress({...base,classification:"INTERNAL"}).allowed,false));
Deno.test("unapproved payload blocked",()=>assert.equal(authorizeExternalEgress({...base,approvedByPolicy:false}).allowed,false));
Deno.test("code review blocked",()=>assert.equal(authorizeExternalEgress({...base,purpose:"CODE_REVIEW"}).allowed,false));
Deno.test("known secret names blocked",()=>assert.equal(authorizeExternalEgress({...base,payload:"OPENROUTER_API_KEY"}).allowed,false));
Deno.test("private keys blocked",()=>assert.equal(authorizeExternalEgress({...base,payload:"-----BEGIN PRIVATE KEY-----"}).allowed,false));
