import { strict as assert } from "node:assert";
import { evaluateResourceEvidence, type Evidence } from "./tinyfish_resource_evidence.ts";
const example: Evidence = {
 provider:"Example",officialDocsUrl:"https://example.com/docs",
 termsUrl:"https://example.com/terms",pricingUrl:"https://example.com/pricing",
 freeTierExplicit:true,allowedForAutomatedUse:true,quotaRequestsPerDay:100,
 requiresPaymentMethod:false,checkedAt:new Date().toISOString(),authenticatedAvailabilityTest:true
};
Deno.test("complete claims still require controlled review before production",()=>{
 const d=evaluateResourceEvidence(example);
 assert.equal(d.status,"ELIGIBLE_FOR_CONTROLLED_TEST");
 assert.equal(d.productionReady,false);
});
Deno.test("missing free tier and automated permission fail closed",()=>{
 const d=evaluateResourceEvidence({...example,freeTierExplicit:false,allowedForAutomatedUse:null});
 assert.equal(d.status,"REQUIRES_REVIEW");
 assert(d.reasons.includes("FREE_TIER_NOT_ESTABLISHED"));
 assert(d.reasons.includes("AUTOMATION_PERMISSION_UNCONFIRMED"));
});
Deno.test("payment method required blocks promotion",()=>{
 const d=evaluateResourceEvidence({...example,requiresPaymentMethod:true});
 assert.equal(d.productionReady,false);
 assert(d.reasons.includes("PAYMENT_METHOD_UNCONFIRMED"));
});
Deno.test("untrusted local URLs rejected",()=>{
 const d=evaluateResourceEvidence({...example,termsUrl:"http://localhost/private"});
 assert(d.reasons.includes("MISSING_PUBLIC_OFFICIAL_URLS"));
});
Deno.test("missing live availability prevents eligibility",()=>{
 const d=evaluateResourceEvidence({...example,authenticatedAvailabilityTest:false});
 assert.equal(d.status,"REQUIRES_REVIEW");
});

Deno.test("future-dated official evidence cannot pass eligibility",()=>{
 const d=evaluateResourceEvidence({...example,checkedAt:new Date(Date.now()+3600000).toISOString()});
 assert.equal(d.status,"REQUIRES_REVIEW");
 assert(d.reasons.includes("EVIDENCE_STALE"));
});
