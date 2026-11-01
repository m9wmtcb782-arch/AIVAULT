"""AIVAULT 神經系統 PoC（CPU、本機、免費）。Apple-inspired（非複製）：共用小型基座 + 每技能 LoRA 轉接器 + 學習式路由器。
實驗：
 1) 基座＋3 個轉接器（reverse / sort / add1）共同訓練；路由器從輸入 token 學會選轉接器。
 2) 新增第 4 技能（cummax）：凍結基座與舊轉接器，只訓練新轉接器＋路由器 → 量舊技能準確率前後。
    對照組：直接微調整個基座（無轉接器）→ 量遺忘。
 3) Net2Net 式功能保持：FFN 加寬（新神經元輸出權重 0）、加深（新層輸出投影 0）→ 輸出必須完全相同。
"""
import torch, torch.nn as nn, torch.nn.functional as F, json, time, copy, sys
torch.manual_seed(0); torch.set_num_threads(4)
L, V = 8, 10; TASKS = ["reverse", "sort", "add1", "cummax"]; TOK = {t: V + i for i, t in enumerate(TASKS)}; VOCAB = V + len(TASKS)
def gen(task, n):
    x = torch.randint(0, V, (n, L))
    if task == "reverse": y = x.flip(1)
    elif task == "sort": y = x.sort(1).values
    elif task == "add1": y = (x + 1) % V
    else: y = torch.cummax(x, 1).values
    inp = torch.cat([torch.full((n, 1), TOK[task]), x], 1); return inp, y
class LoRA(nn.Module):
    def __init__(s, d_in, d_out, r=8):
        super().__init__(); s.A = nn.Parameter(torch.randn(r, d_in) * 0.02); s.B = nn.Parameter(torch.zeros(d_out, r))  # B=0 → 新轉接器初始不改變輸出
    def forward(s, x): return x @ s.A.t() @ s.B.t()
class Block(nn.Module):
    def __init__(s, d, h, f):
        super().__init__(); s.ln1 = nn.LayerNorm(d); s.att = nn.MultiheadAttention(d, h, batch_first=True); s.ln2 = nn.LayerNorm(d); s.f1 = nn.Linear(d, f); s.f2 = nn.Linear(f, d)
    def forward(s, x, ad=None):
        h = s.ln1(x); a, _ = s.att(h, h, h, need_weights=False); x = x + a
        h = s.ln2(x); u = s.f1(h) + (ad["f1"](h) if ad else 0); x = x + s.f2(F.gelu(u)) + (ad["f2"](F.gelu(u)) if ad else 0); return x
class Nervous(nn.Module):
    def __init__(s, d=192, h=4, f=768, n=4, r=8):
        super().__init__(); s.d, s.f, s.r = d, f, r; s.emb = nn.Embedding(VOCAB, d); s.pos = nn.Parameter(torch.randn(L + 1, d) * 0.02)
        s.blocks = nn.ModuleList([Block(d, h, f) for _ in range(n)]); s.lnf = nn.LayerNorm(d); s.head = nn.Linear(d, V)
        s.adapters = nn.ModuleList(); s.router = nn.Linear(d, 0)
    def add_adapter(s):
        s.adapters.append(nn.ModuleList([nn.ModuleDict({"f1": LoRA(s.d, s.blocks[i].f1.out_features, s.r), "f2": LoRA(s.blocks[i].f1.out_features, s.d, s.r)}) for i in range(len(s.blocks))]))
        old = s.router; new = nn.Linear(s.d, len(s.adapters)); 
        with torch.no_grad():
            if old.out_features: new.weight[:old.out_features] = old.weight; new.bias[:old.out_features] = old.bias
        s.router = new
    def route_logits(s, inp): return s.router(s.emb(inp).mean(1))  # 路由器只看輸入 token（不看標籤）
    def forward(s, inp, use_adapter=True, force=None):
        x = s.emb(inp) + s.pos; k = None
        if use_adapter and len(s.adapters): k = force if force is not None else s.route_logits(inp).argmax(-1)
        outs = []
        if k is None:
            for b in s.blocks: x = b(x)
            return s.head(s.lnf(x))[:, 1:]
        res = torch.zeros(inp.shape[0], L, V)
        for j in range(len(s.adapters)):  # top-1 路由：每個樣本只走一個轉接器
            m = (k == j)
            if not m.any(): continue
            xj = x[m]
            for bi, b in enumerate(s.blocks): xj = b(xj, s.adapters[j][bi])
            res[m] = s.head(s.lnf(xj))[:, 1:]
        return res
def acc(model, task, n=2000, **kw):
    model.eval()
    with torch.no_grad(): i, y = gen(task, n); p = model(i, **kw).argmax(-1); return round((p == y).all(1).float().mean().item(), 4)
def route_acc(model, task, n=1000):
    with torch.no_grad(): i, _ = gen(task, n); return round((model.route_logits(i).argmax(-1) == TASKS.index(task)).float().mean().item(), 4)
def train(model, tasks, params, steps, lr=2e-3, router=True, use_adapter=True, bs=128):
    opt = torch.optim.AdamW(params, lr=lr); model.train()
    for st in range(steps):
        loss = 0
        for t in tasks:
            i, y = gen(t, bs); tid = torch.full((bs,), TASKS.index(t))
            out = model(i, use_adapter=use_adapter, force=tid if use_adapter else None); loss = loss + F.cross_entropy(out.reshape(-1, V), y.reshape(-1))
            if router and use_adapter: loss = loss + F.cross_entropy(model.route_logits(i), tid)
        opt.zero_grad(); loss.backward(); opt.step()
    return loss.item()
R = {"inspired_by_apple_not_a_copy": True}; t0 = time.time(); STEPS = int(sys.argv[1]) if len(sys.argv) > 1 else 1500
# ---------- 1) 基座 + 3 轉接器 ----------
m = Nervous(); [m.add_adapter() for _ in range(3)]
R["params_base"] = sum(p.numel() for n_, p in m.named_parameters() if not n_.startswith(("adapters", "router"))); R["params_per_adapter"] = sum(p.numel() for p in m.adapters[0].parameters())
train(m, TASKS[:3], m.parameters(), STEPS)
R["phase1"] = {t: acc(m, t) for t in TASKS[:3]}; R["phase1_router"] = {t: route_acc(m, t) for t in TASKS[:3]}
snap = copy.deepcopy(m)
# ---------- 2) 新增技能：凍結基座/舊轉接器 ----------
m.add_adapter()
for n_, p in m.named_parameters(): p.requires_grad = n_.startswith("adapters.3") or n_.startswith("router")
before = {t: acc(m, t, force=None) for t in TASKS[:3]}
train(m, TASKS, [p for p in m.parameters() if p.requires_grad], STEPS)
R["phase2_adapter"] = {"old_before": before, "old_after": {t: acc(m, t) for t in TASKS[:3]}, "new_task": acc(m, "cummax"), "router": {t: route_acc(m, t) for t in TASKS},
  "old_adapter_weights_unchanged": all(torch.equal(a, b) for a, b in zip(snap.adapters.parameters(), list(m.adapters[:3].parameters()))),
  "base_weights_unchanged": all(torch.equal(a, b) for (na, a), (nb, b) in zip(snap.named_parameters(), m.named_parameters()) if not na.startswith(("adapters", "router")))}
# 對照：無轉接器，直接微調全基座學新技能（典型遺忘）
b = Nervous(); train(b, TASKS[:3], b.parameters(), STEPS, use_adapter=False)  # 無任務感知? 有：task token 在輸入
nb = {t: acc(b, t, use_adapter=False) for t in TASKS[:3]}; train(b, ["cummax"], b.parameters(), STEPS, use_adapter=False)
R["phase2_naive_finetune"] = {"old_before": nb, "old_after": {t: acc(b, t, use_adapter=False) for t in TASKS[:3]}, "new_task": acc(b, "cummax", use_adapter=False)}
# ---------- 3) Net2Net 式加寬 / 加深（功能保持） ----------
def widen(model, extra):
    for blk in model.blocks:
        f1, f2 = blk.f1, blk.f2; n1 = nn.Linear(f1.in_features, f1.out_features + extra); n2 = nn.Linear(f2.in_features + extra, f2.out_features)
        with torch.no_grad():
            n1.weight[:f1.out_features] = f1.weight; n1.bias[:f1.out_features] = f1.bias; nn.init.normal_(n1.weight[f1.out_features:], std=0.02)
            n2.weight.zero_(); n2.weight[:, :f2.in_features] = f2.weight; n2.bias.copy_(f2.bias)  # 新神經元輸出權重 = 0
        blk.f1, blk.f2 = n1, n2
def deepen(model, at):
    nb_ = Block(model.d, 4, model.blocks[0].f1.out_features)
    with torch.no_grad(): nb_.att.out_proj.weight.zero_(); nb_.att.out_proj.bias.zero_(); nb_.f2.weight.zero_(); nb_.f2.bias.zero_()  # 新層 = 恆等映射
    model.blocks.insert(at, nb_)
nn_ = copy.deepcopy(b); i, _ = gen("reverse", 512)
with torch.no_grad(): ref = nn_(i, use_adapter=False)
widen(nn_, 256); 
with torch.no_grad(): w = nn_(i, use_adapter=False)
deepen(nn_, 2)
with torch.no_grad(): d_ = nn_(i, use_adapter=False)
R["net2net"] = {"params_before": sum(p.numel() for p in b.parameters()), "params_after": sum(p.numel() for p in nn_.parameters()),
  "max_abs_diff_after_widen": float((w - ref).abs().max()), "max_abs_diff_after_deepen": float((d_ - ref).abs().max()), "argmax_identical": bool(torch.equal(d_.argmax(-1), ref.argmax(-1)))}
cm0 = acc(nn_, "cummax", use_adapter=False); train(nn_, ["cummax"], nn_.parameters(), max(200, STEPS // 5), use_adapter=False)
R["net2net"]["grown_model_still_trainable_cummax"] = [cm0, acc(nn_, "cummax", use_adapter=False)]
R["seconds"] = round(time.time() - t0, 1); R["steps"] = STEPS
print(json.dumps(R, indent=1, ensure_ascii=False)); json.dump(R, open("results.json", "w"), indent=1, ensure_ascii=False)
