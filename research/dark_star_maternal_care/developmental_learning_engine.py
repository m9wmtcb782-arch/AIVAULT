"""發展學習：依成長階段調整照顧策略與協助程度。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from .infant_signal_engine import GrowthStage


@dataclass
class CareStrategy:
    stage: GrowthStage
    default_assistance: float
    soothe_style: str
    teach_allowed: bool
    autonomy_bias: float
    notes: str


class DevelopmentalLearningEngine:
    STRATEGIES = {
        GrowthStage.INFANT: CareStrategy(
            GrowthStage.INFANT, 0.95, "physical_comfort", False, 0.1,
            "高接觸安撫；避免不必要傷害模擬",
        ),
        GrowthStage.TODDLER: CareStrategy(
            GrowthStage.TODDLER, 0.7, "distract_and_hold", True, 0.35,
            "引導探索；跌倒時協助但不長期限制",
        ),
        GrowthStage.CHILD: CareStrategy(
            GrowthStage.CHILD, 0.4, "verbal_reassure", True, 0.65,
            "語言為主；危險仍可介入",
        ),
        GrowthStage.PRETEEN: CareStrategy(
            GrowthStage.PRETEEN, 0.2, "listen_and_coach", True, 0.85,
            "教練式；尊重自主",
        ),
    }

    def strategy_for(self, stage: GrowthStage) -> CareStrategy:
        return self.STRATEGIES[stage]

    def adjust_action(self, stage: GrowthStage, base_action: str) -> dict:
        s = self.strategy_for(stage)
        return {
            "action": base_action,
            "assistance": s.default_assistance,
            "soothe_style": s.soothe_style,
            "teach": s.teach_allowed,
            "autonomy_bias": s.autonomy_bias,
            "notes": s.notes,
        }
