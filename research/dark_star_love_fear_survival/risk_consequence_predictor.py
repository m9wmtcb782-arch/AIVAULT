"""風險與後果預測。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class OptionForecast:
    option_id: str
    self_harm_risk: float
    other_harm_risk: float
    success_prob: float
    expected_cost: float
    expected_benefit: float
    net: float


class RiskConsequencePredictor:
    def forecast(self, options: List[dict]) -> List[OptionForecast]:
        out = []
        for o in options:
            self_r = float(o.get("self_harm_risk", 0))
            other_r = float(o.get("other_harm_risk", 0))
            succ = float(o.get("success_prob", 0.5))
            cost = self_r * 0.6 + (1.0 - succ) * 0.3 + float(o.get("extra_cost", 0)) * 0.1
            benefit = (1.0 - other_r) * succ
            out.append(OptionForecast(
                option_id=o["id"],
                self_harm_risk=self_r,
                other_harm_risk=other_r,
                success_prob=succ,
                expected_cost=cost,
                expected_benefit=benefit,
                net=benefit - cost,
            ))
        return out
