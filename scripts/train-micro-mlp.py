#!/usr/bin/env python3
"""Train AIVAULT Stage (b) micro MLP on synthetic data (numpy only, free).

Architecture: 64 -> 48 -> 32 -> 5, ReLU, logits (no softmax in forward for compare).
Exports little-endian float32 weights + fixed 100-input reference pack.
NOT Qwen. NOT cross-device. No paid APIs.
"""
from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "models" / "micro-mlp"
ARCH = [64, 48, 32, 5]
SEED = 20261024
N_TRAIN = 4000
N_TEST = 1000
N_REF = 100
LR = 0.05
EPOCHS = 60
BATCH = 64


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def make_blobs(n: int, rng: np.random.Generator, means: np.ndarray):
    """5-class isotropic Gaussians in 64-d (shared class means)."""
    X = np.empty((n, 64), dtype=np.float64)
    y = np.empty(n, dtype=np.int64)
    for i in range(n):
        c = int(rng.integers(0, 5))
        X[i] = means[c] + rng.normal(0, 0.55, size=64)
        y[i] = c
    perm = rng.permutation(n)
    return X[perm].astype(np.float32), y[perm]


def init_params(rng: np.random.Generator):
    params = []
    for a, b in zip(ARCH, ARCH[1:]):
        # He init for ReLU
        W = (rng.normal(0, np.sqrt(2.0 / a), size=(b, a))).astype(np.float32)
        bias = np.zeros(b, dtype=np.float32)
        params.append((W, bias))
    return params


def forward(params, X: np.ndarray, training=False):
    """X: [N, in]. Returns logits [N, 5] and cache for backprop if training."""
    acts = [X]
    h = X
    for i, (W, b) in enumerate(params):
        z = h @ W.T + b  # [N, out]
        if i < len(params) - 1:
            h = np.maximum(z, 0).astype(np.float32)
            acts.append(h)
        else:
            acts.append(z.astype(np.float32))
            return z.astype(np.float32), acts
    raise RuntimeError("unreachable")


def softmax_ce(logits: np.ndarray, y: np.ndarray):
    m = logits.max(axis=1, keepdims=True)
    e = np.exp(logits - m)
    p = e / e.sum(axis=1, keepdims=True)
    n = logits.shape[0]
    loss = -np.log(p[np.arange(n), y] + 1e-12).mean()
    return loss, p


def backward(params, acts, p, y):
    """Manual backprop; acts[0]=X, acts[1]=h1, acts[2]=h2, acts[3]=logits."""
    n = y.shape[0]
    grads = []
    d = p.copy()
    d[np.arange(n), y] -= 1.0
    d /= n
    # layer 2 (last)
    for i in range(len(params) - 1, -1, -1):
        W, b = params[i]
        h_in = acts[i]
        dW = (d.T @ h_in).astype(np.float32)
        db = d.sum(axis=0).astype(np.float32)
        grads.append((dW, db))
        if i > 0:
            dh = d @ W
            # ReLU'
            dh = dh * (acts[i] > 0)
            d = dh.astype(np.float32)
    grads.reverse()
    return grads


def sgd(params, grads, lr):
    out = []
    for (W, b), (dW, db) in zip(params, grads):
        out.append((W - lr * dW, b - lr * db))
    return out


def accuracy(logits, y):
    return float((logits.argmax(1) == y).mean())


def pack_weights(params) -> bytes:
    chunks = []
    for W, b in params:
        chunks.append(np.ascontiguousarray(W, dtype=np.float32).tobytes())
        chunks.append(np.ascontiguousarray(b, dtype=np.float32).tobytes())
    return b"".join(chunks)


def main():
    rng = np.random.default_rng(SEED)
    means = rng.normal(0, 1.2, size=(5, 64)).astype(np.float64)
    Xtr, ytr = make_blobs(N_TRAIN, rng, means)
    Xte, yte = make_blobs(N_TEST, rng, means)
    params = init_params(rng)

    for ep in range(EPOCHS):
        perm = rng.permutation(N_TRAIN)
        for s in range(0, N_TRAIN, BATCH):
            idx = perm[s : s + BATCH]
            xb, yb = Xtr[idx], ytr[idx]
            logits, acts = forward(params, xb, training=True)
            _, p = softmax_ce(logits, yb)
            grads = backward(params, acts, p, yb)
            params = sgd(params, grads, LR)
        if (ep + 1) % 20 == 0 or ep == 0:
            tr_logits, _ = forward(params, Xtr)
            te_logits, _ = forward(params, Xte)
            print(
                f"epoch {ep+1:3d} train_acc={accuracy(tr_logits, ytr):.3f} "
                f"test_acc={accuracy(te_logits, yte):.3f} "
                f"train_loss={softmax_ce(tr_logits, ytr)[0]:.4f}"
            )

    # Fixed reference pack: first N_REF of test set (already deterministic via seed)
    Xref = Xte[:N_REF].astype(np.float32)
    yref = yte[:N_REF]
    logits_ref, _ = forward(params, Xref)
    top1 = logits_ref.argmax(1).astype(np.int32)
    host_acc = accuracy(logits_ref, yref)
    # Also full test accuracy for doc
    full_te_logits, _ = forward(params, Xte)
    full_acc = accuracy(full_te_logits, yte)

    OUT.mkdir(parents=True, exist_ok=True)
    weights = pack_weights(params)
    inputs_bin = np.ascontiguousarray(Xref, dtype=np.float32).tobytes()
    logits_bin = np.ascontiguousarray(logits_ref, dtype=np.float32).tobytes()
    top1_bin = np.ascontiguousarray(top1, dtype=np.int32).tobytes()

    (OUT / "weights.f32.bin").write_bytes(weights)
    (OUT / "ref-inputs.f32.bin").write_bytes(inputs_bin)
    (OUT / "ref-logits.f32.bin").write_bytes(logits_bin)
    (OUT / "ref-top1.i32.bin").write_bytes(top1_bin)

    layout = []
    offset = 0
    names = [("W1", (48, 64)), ("b1", (48,)), ("W2", (32, 48)), ("b2", (32,)), ("W3", (5, 32)), ("b3", (5,))]
    for name, shape in names:
        count = int(np.prod(shape))
        layout.append({"name": name, "shape": list(shape), "offset_floats": offset, "count": count})
        offset += count

    assert offset * 4 == len(weights), (offset * 4, len(weights))

    manifest = {
        "model_id": "owned-micro-mlp-v1",
        "stage": "b-single-phone-micro-nn",
        "neural_network": "micro-mlp-only",
        "not": ["Qwen", "cross-device", "stage-c", "stage-d", "stage-e"],
        "framework_train": "numpy",
        "arch": ARCH,
        "activation": "relu",
        "dtype": "float32",
        "endian": "little",
        "param_count": offset,
        "weights_file": "weights.f32.bin",
        "weights_sha256": sha256_bytes(weights),
        "weights_bytes": len(weights),
        "layout": layout,
        "seed": SEED,
        "train": {"n": N_TRAIN, "epochs": EPOCHS, "lr": LR, "batch": BATCH},
        "host_test_accuracy_full": full_acc,
        "host_ref_accuracy_100": host_acc,
        "reference": {
            "n": N_REF,
            "inputs_file": "ref-inputs.f32.bin",
            "inputs_sha256": sha256_bytes(inputs_bin),
            "logits_file": "ref-logits.f32.bin",
            "logits_sha256": sha256_bytes(logits_bin),
            "top1_file": "ref-top1.i32.bin",
            "top1_sha256": sha256_bytes(top1_bin),
            "labels": yref.astype(int).tolist(),
            "top1": top1.astype(int).tolist(),
            "tol_logits_abs": 1e-4,
            "require_top1_agreement": 1.0,
        },
        "off_switch": "COMPUTE_NN_MICRO_OFF=1",
        "notes": "Airplane-mode capable once page+assets cached. GPU path uses WebGPU; CPU JS path always available and labeled.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Sanity: reload and check bit-identical forward
    flat = np.frombuffer(weights, dtype=np.float32)
    def slice_param(entry):
        s = entry["offset_floats"]
        c = entry["count"]
        return flat[s : s + c].reshape(entry["shape"]).copy()

    W1 = slice_param(layout[0]); b1 = slice_param(layout[1])
    W2 = slice_param(layout[2]); b2 = slice_param(layout[3])
    W3 = slice_param(layout[4]); b3 = slice_param(layout[5])
    h = np.maximum(Xref @ W1.T + b1, 0)
    h = np.maximum(h @ W2.T + b2, 0)
    logits2 = h @ W3.T + b3
    err = float(np.max(np.abs(logits2 - logits_ref)))
    assert err == 0.0, err
    print("Wrote", OUT)
    print("params", offset, "bytes", len(weights))
    print("ref_acc", host_acc, "full_test_acc", full_acc, "reload_err", err)


if __name__ == "__main__":
    main()
