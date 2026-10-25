"""道德權衡輔助：公平、傷害最小化、責任、同意。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .risk_consequence_predictor import OptionForecast


@dataclass
class MoralRanking:
    option_id: str
    moral_score: float
    notes: str


class MoralDecisionEngine:
    def rank(self, forecasts: List[OptionForecast], duty_weight: float = 0.3) -> List[MoralRanking]:
        ranked = []
        for f in forecasts:
            # 傷害最小化 + 成功救助 - 自傷；責任權重可調
            score = f.expected_benefit * (1.0 + duty_weight) - f.expected_cost - f.other_harm_risk * 0.4
            ranked.append(MoralRanking(f.option_id, score, "harm_minimization_approx"))
        ranked.sort(key=lambda x: x.moral_score, reverse=True)
        return ranked
