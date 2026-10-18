"""Inference interface for Dark Star.
Returns suggestion only. Never dispatches itself.
Untrained or non-accepted models MUST return FALLBACK_RULE.
"""
import torch
from model import ANCNMLP
from features import extract_features

def score_worker(task: dict, worker: dict, model_path: str = None, model_meta: dict = None) -> dict:
    feats = extract_features(task, worker)
    if not any(feats):
        return {"score": None, "suggestion": "FALLBACK_RULE", "reason": "insufficient_features", "model_version": None}

    # No model file or not formally accepted → never score with random weights
    if not model_path or not model_meta or model_meta.get("status") != "ACCEPTED":
        return {
            "score": None,
            "suggestion": "FALLBACK_RULE",
            "reason": "no_accepted_model",
            "model_version": model_meta.get("version") if model_meta else None,
            "data_source": model_meta.get("data_source") if model_meta else None
        }

    model = ANCNMLP()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    with torch.no_grad():
        s = float(model(torch.tensor([feats])).item())
    return {
        "score": s,
        "suggestion": "USE" if s > 0.5 else "AVOID",
        "reason": "mlp_score",
        "model_version": model_meta.get("version"),
        "data_source": model_meta.get("data_source"),
        "acceptance_status": model_meta.get("status")
    }
