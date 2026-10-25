"""好感引擎：依對象維護不同好感記憶與變化。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

from .attraction_model import AttractionFactors, AttractionModel, AttractionScore


@dataclass
class AffectionState:
    partner_id: str
    affection: float = 0.0
    last_attraction: float = 0.0
    interaction_n: int = 0


class AffectionEngine:
    def __init__(self) -> None:
        self.by_partner: Dict[str, AffectionState] = {}
        self.model = AttractionModel()

    def update(self, partner_id: str, factors: AttractionFactors, delta_warmth: float = 0.0) -> AffectionState:
        score: AttractionScore = self.model.score(partner_id, factors)
        st = self.by_partner.setdefault(partner_id, AffectionState(partner_id=partner_id))
        st.interaction_n += 1
        st.last_attraction = score.composite
        # 緩慢累積，不同對象獨立
        st.affection = min(1.0, st.affection * 0.96 + score.composite * 0.08 + delta_warmth * 0.05)
        return st

    def get(self, partner_id: str) -> AffectionState:
        return self.by_partner.get(partner_id) or AffectionState(partner_id=partner_id)
