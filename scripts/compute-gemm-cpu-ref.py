#!/usr/bin/env python3
"""Host-side numpy oracle for AIVAULT Stage (a) tiled GEMM fill formula.

Matches assets/compute-pool/gemm-engine.js fillMatrix / cpuMatmul intent.
Does NOT use any paid API. Matmul only — not a neural network.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys

import numpy as np


def fill_matrix(n: int, seed: int, which: int) -> np.ndarray:
    base = (seed & 0xFFFFFFFF) + which * 10007
    out = np.empty((n, n), dtype=np.float32)
    for i in range(n):
        for j in range(n):
            v = ((i * 31 + j * 17 + base) % 2001) - 1000
            out[i, j] = np.float32(v / 10000.0)
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--sizes", default="256,512,1024")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    report = {
        "stage": "a-cpu-ref",
        "neural_network": "NOT_AVAILABLE",
        "capability": "matmul-only",
        "seed": args.seed,
        "matrices": [],
    }
    for part in args.sizes.split(","):
        n = int(part.strip())
        A = fill_matrix(n, args.seed, 0)
        B = fill_matrix(n, args.seed, 1)
        # float64 accumulate then cast — for cross-check ranges only
        C64 = A.astype(np.float64) @ B.astype(np.float64)
        C = C64.astype(np.float32)
        report["matrices"].append(
            {
                "n": n,
                "A_sha256": hashlib.sha256(A.tobytes()).hexdigest(),
                "B_sha256": hashlib.sha256(B.tobytes()).hexdigest(),
                "C_f64_then_f32_sha256": hashlib.sha256(C.tobytes()).hexdigest(),
                "C_max_abs": float(np.max(np.abs(C))),
                "note": "GPU page verifies against JS Float32 cpuMatmul, not this C hash",
            }
        )
    json.dump(report, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
