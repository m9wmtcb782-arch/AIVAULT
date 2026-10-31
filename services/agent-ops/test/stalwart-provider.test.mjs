// MOCK fetch: retry/backoff, idempotency, local-part validation. (Real server results: evidence/stalwart-*.json, LOCAL.)
import test from "node:test"; import assert from "node:assert/strict";
import { StalwartProvider } from "../src/stalwart-provider.mjs";
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
test("retries 503 then creates; reuses existing; rejects bad local part", async () => {
  let n = 0, accounts = [];
  const fetchImpl = async (_u, o) => { n++; if (n === 1) return { ok: false, status: 503 };
    const [[m, a]] = JSON.parse(o.body).methodCalls;
    if (m === "x:Domain/get") return ok({ methodResponses: [[m, { list: [{ id: "b", name: "aivault.net.eu.org" }] }, "d"]] });
    if (m === "x:Account/query") return ok({ methodResponses: [[m, { ids: accounts.filter(x => x.name === a.filter?.name).map(x => x.id) }, "q"]] });
    if (m === "x:Account/get") return ok({ methodResponses: [[m, { list: accounts }, "g"]] });
    if (m === "x:Account/set") { const id = "id" + accounts.length; accounts.push({ id, name: a.create.n.name, domainId: "b" }); return ok({ methodResponses: [[m, { created: { n: { id } } }, "c"]] }); } };
  const sp = new StalwartProvider({ baseUrl: "http://127.0.0.1:1", adminAuth: "a:b", domain: "aivault.net.eu.org", fetchImpl, backoffMs: 1 });
  const r1 = await sp.createMailbox({ localPart: "linganan1u", password: "x".repeat(43) });
  assert.equal(r1.reused, false); assert.equal(r1.address, "linganan1u@aivault.net.eu.org");
  const r2 = await sp.createMailbox({ localPart: "linganan1u", password: "y".repeat(43) });
  assert.equal(r2.reused, true); assert.equal(accounts.length, 1);
  await assert.rejects(sp.createMailbox({ localPart: "Bad.Name", password: "z" }), /INVALID_LOCAL_PART/);
  await assert.rejects(new StalwartProvider({ baseUrl: "http://x", adminAuth: "a:b", domain: "d" }).resetLocalAccounts({ allowDestructiveLocal: true }), /REFUSED/);
});
