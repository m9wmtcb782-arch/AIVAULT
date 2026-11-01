"""Memory-augmented tiny NN PoC (CPU, toy, simulated data — NOT real AIVAULT traffic).
Task family: each "rule" r is a hidden permutation of 10 symbols; query (r, x) -> perm_r[x].
- no-memory model: sees (rule-id, x). Cannot know unseen rules -> ~chance on held-out rules.
- memory model: retrieves the ACTIVE common-memory entry for rule r (same semantics as cm_status:
  pending/quarantined/revoked are invisible) and reads the table. Generalises to held-out rules.
- poison: an attacker entry for a held-out rule gets verified (worst case) -> wrong answers;
  cm_revoke() -> previous version becomes the active one again -> correctness restored, and its
  derived adapter training rows are invalidated (cascade), so the adapter is retrained without them.
"""
import json, random, torch, torch.nn as nn
torch.manual_seed(0); random.seed(0)
S, R_TRAIN, R_HELD, D = 10, 200, 50, 64
rules = [torch.randperm(S) for _ in range(R_TRAIN + R_HELD)]
class Mem:  # minimal mirror of cm_entries + cm_events semantics
    def __init__(s): s.rows = []
    def propose(s, key, val, by, verified): s.rows.append(dict(id=len(s.rows), key=key, val=val, by=by, state="active" if verified else "pending", ver=sum(r["key"] == key for r in s.rows) + 1, derived=[]))
    def revoke(s, i):
        s.rows[i]["state"] = "revoked"
        for d in s.rows[i]["derived"]: d["valid"] = False   # cascade to adapter training rows
    def get(s, key):
        a = [r for r in s.rows if r["key"] == key and r["state"] == "active"]
        return max(a, key=lambda r: r["ver"]) if a else None
mem = Mem()
for r, p in enumerate(rules): mem.propose(r, p.clone(), "darkstar", True)
class NoMem(nn.Module):
    def __init__(s): super().__init__(); s.r = nn.Embedding(R_TRAIN + R_HELD, D); s.x = nn.Embedding(S, D); s.f = nn.Sequential(nn.Linear(2 * D, 128), nn.ReLU(), nn.Linear(128, S))
    def forward(s, r, x, tab=None): return s.f(torch.cat([s.r(r), s.x(x)], -1))
class WithMem(nn.Module):  # attention over retrieved table slots (key = position, value = symbol)
    def __init__(s): super().__init__(); s.pos = nn.Embedding(S, D); s.val = nn.Embedding(S + 1, D); s.q = nn.Embedding(S, D); nn.init.normal_(s.pos.weight, std=2); s.q.weight.data = s.pos.weight.data.clone() * 2; s.out = nn.Linear(D, S); s.fallback = nn.Parameter(torch.zeros(D))
    def forward(s, r, x, tab):
        k = s.pos.weight.unsqueeze(0).expand(len(x), S, D); v = s.val(tab)               # tab = S (=10) means "no memory"
        a = torch.softmax((s.q(x).unsqueeze(1) * k).sum(-1) / D ** 0.5, -1)
        return s.out((a.unsqueeze(-1) * v).sum(1))
def table(r, use_mem=True):
    e = mem.get(r) if use_mem else None
    return e["val"] if e is not None else torch.full((S,), S)
def batch(rs):
    r = torch.tensor([random.choice(rs) for _ in range(256)]); x = torch.randint(0, S, (256,))
    y = torch.stack([rules[i][j] for i, j in zip(r.tolist(), x.tolist())]); return r, x, y
def train(m, rs, steps=800):
    o = torch.optim.Adam(m.parameters(), 3e-3)
    for _ in range(steps):
        r, x, y = batch(rs); tab = torch.stack([table(i) for i in r.tolist()])
        l = nn.functional.cross_entropy(m(r, x, tab), y); o.zero_grad(); l.backward(); o.step()
@torch.no_grad()
def acc(m, rs, truth=None):
    r = torch.tensor([i for i in rs for _ in range(S)]); x = torch.tensor([j for _ in rs for j in range(S)])
    y = torch.stack([rules[i][j] for i, j in zip(r.tolist(), x.tolist())]); tab = torch.stack([table(i) for i in r.tolist()])
    return round((m(r, x, tab).argmax(-1) == y).float().mean().item() * 100, 2)
TR, HE = list(range(R_TRAIN)), list(range(R_TRAIN, R_TRAIN + R_HELD))
nm, wm = NoMem(), WithMem(); train(nm, TR); train(wm, TR)
res = {"simulated": True, "train_rules": R_TRAIN, "heldout_rules": R_HELD,
       "nomem_train_acc": acc(nm, TR), "nomem_heldout_acc": acc(nm, HE), "mem_train_acc": acc(wm, TR), "mem_heldout_acc": acc(wm, HE)}
# poisoning: attacker entries for 10 held-out rules; (a) unverified -> pending -> invisible
victims = HE[:10]
for r in victims: mem.propose(r, torch.roll(rules[r], 1), "attacker", False)
res["heldout_acc_after_unverified_poison"] = acc(wm, HE)
# (b) worst case: poison slipped through verification -> active newer version
poison_ids = []
for r in victims:
    for row in mem.rows:
        if row["key"] == r and row["by"] == "attacker": row["state"] = "active"; row["ver"] = 9; poison_ids.append(row["id"])
res["victim_acc_after_verified_poison"] = acc(wm, victims); res["heldout_acc_after_verified_poison"] = acc(wm, HE)
# adapter training set = rows derived from ACTIVE entries; poisoned entries produced derived rows too
train_rows = []
for row in mem.rows:
    if row["state"] == "active" and row["key"] in HE:
        d = {"entry": row["id"], "valid": True}; row["derived"].append(d); train_rows.append(d)
res["adapter_rows_before_revoke"] = sum(d["valid"] for d in train_rows)
for i in poison_ids: mem.revoke(i)
res["victim_acc_after_revoke"] = acc(wm, victims); res["heldout_acc_after_revoke"] = acc(wm, HE)
res["adapter_rows_after_revoke"] = sum(d["valid"] for d in train_rows); res["adapter_rows_invalidated"] = len(poison_ids)
print(json.dumps(res, ensure_ascii=False, indent=1)); json.dump(res, open("memory_nn_results.json", "w"), indent=1)
