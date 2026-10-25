"""自主神經→決策／行為鉤子（非只表情）。"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AutonomicDecisionBias:
    freeze: float
    flee: float
    fight_or_rescue: float
    heart_rate_scale: float
    action_latency_scale: float  # >1 較慢（恐懼僵住）
    expression_hook: float
    participates_in_risk_decision: bool = True
    expression_only_forbidden: bool = True


class AutonomicResponseBridge:
    def bias(self, fear_intensity: float, autonomic: float, protect_motivation: float) -> AutonomicDecisionBias:
        freeze = min(1.0, fear_intensity * 0.5 * (1.0 - protect_motivation))
        flee = min(1.0, autonomic * 0.6 * (1.0 - protect_motivation * 0.5))
        rescue = min(1.0, protect_motivation * 0.7 + (1.0 - flee) * 0.2)
        return AutonomicDecisionBias(
            freeze=freeze,
            flee=flee,
            fight_or_rescue=rescue,
            heart_rate_scale=1.0 + 0.5 * autonomic,
            action_latency_scale=1.0 + 0.4 * freeze,
            expression_hook=min(1.0, fear_intensity * 0.5),
        )
