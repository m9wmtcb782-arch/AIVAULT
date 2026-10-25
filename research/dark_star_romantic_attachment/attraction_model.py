"""吸引模型：個性談吐、興趣價值、外表聲音風格、善意尊重可靠、共同經歷、信任安全感。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class AttractionFactors:
    personality_rapport: float = 0.0
    shared_interests: float = 0.0
    aesthetic_preference: float = 0.0  # 外表／聲音／風格偏好（個體差異）
    kindness_respect: float = 0.0
    reliability: float = 0.0
    shared_experience: float = 0.0
    trust_safety: float = 0.0


@dataclass
class AttractionScore:
    partner_id: str
    factors: AttractionFactors
    composite: float
    evidence_tier: str = "approximation"


class AttractionModel:
    WEIGHTS = {
        "personality_rapport": 0.18,
        "shared_interests": 0.14,
        "aesthetic_preference": 0.12,
        "kindness_respect": 0.18,
        "reliability": 0.14,
        "shared_experience": 0.12,
        "trust_safety": 0.12,
    }

    def score(self, partner_id: str, factors: AttractionFactors) -> AttractionScore:
        d = factors.__dict__
        for k, v in d.items():
            if not (0.0 <= v <= 1.0):
                raise ValueError(f"{k} must be within [0, 1]")
        comp = sum(self.WEIGHTS[k] * d[k] for k in self.WEIGHTS)
        return AttractionScore(partner_id=partner_id, factors=factors, composite=comp)
