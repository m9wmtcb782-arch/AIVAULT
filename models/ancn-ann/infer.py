"""Inference interface for Dark Star.
Returns suggestion only. Never dispatches itself.
If insufficient data, returns fallback flag.
"""
import torch
from model import ANCNMLP
from features import extract_features

def score_worker(task: dict, worker: dict, model_path: str = None) -> dict:
    feats = extract_features(task, worker)
    if not any(feats):  # empty signal
        return {"score": None, "suggestion": "FALLBACK_RULE", "reason": "insufficient_features"}
    model = ANCNMLP()
    if model_path:
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    with torch.no_grad():
        s = float(model(torch.tensor([feats])).item())
    return {
        "score": s,
        "suggestion": "USE" if s > 0.5 else "AVOID",
        "reason": "mlp_score",
        "model_version": "ancn-mlp-v0-synthetic"
    }
