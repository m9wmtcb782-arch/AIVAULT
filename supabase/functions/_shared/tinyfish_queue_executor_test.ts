import { strict as assert } from "node:assert";
import { processDiscoveryQueueItem } from "./tinyfish_queue_executor.ts";
const endpoint = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/free-discovery-search";
const config = { endpoint, supabaseJwt: "offline-jwt", runnerSecret: "x".repeat(40) };
const item = { id: "job-1", query: "free open models", region: "TW" as const, assignedAgentId: "Worker-0101", attempts: 0 };
const response = (status: number, body: unknown) => (async () =>
  new Response(JSON.stringify(body), { status })) as typeof fetch;
assert.equal((await processDiscoveryQueueItem(item, config, response(200, {status:"DISCOVERED",candidates:[]}))).action,"COMPLETE");
assert.equal((await processDiscoveryQueueItem(item, config, response(200, {status:"NO_RESULTS",candidates:[]}))).action,"COMPLETE");
assert.equal((await processDiscoveryQueueItem(item, config, response(429, {}))).action,"DEFER");
assert.equal((await processDiscoveryQueueItem(item, config, response(503, {}))).action,"DEFER");
assert.equal((await processDiscoveryQueueItem(item, config, response(403, {}))).action,"REJECT");
assert.equal((await processDiscoveryQueueItem(item, config, response(200, {status:"BLOCKED"}))).action,"REJECT");
assert.equal((await processDiscoveryQueueItem({...item,attempts:3},config,response(200,{}))).action,"REJECT");
assert.equal((await processDiscoveryQueueItem({...item,attempts:2},config,response(429,{}))).action,"REJECT");
assert.equal((await processDiscoveryQueueItem({...item,assignedAgentId:"Worker-0001"},config,response(200,{}))).action,"REJECT");
assert.equal((await processDiscoveryQueueItem(item,{...config,runnerSecret:""},response(200,{}))).action,"REJECT");
console.log("TinyFish queue executor offline tests PASS");
