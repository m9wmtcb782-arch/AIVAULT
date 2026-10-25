"""保護行為：偵測→評估→預測→保護→觀察→寫記憶。

照顧 ≠ 永遠限制；隨能力提升調整協助。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ProtectionCycle:
    detected: str
    assessed_risk: float
    predicted: str
    action: str
    observed_outcome: str
    memory_written: bool
    limited_autonomy_temporarily: bool
    assistance_level: float  # 隨成長下降
    motor_hints: List[str] = field(default_factory=list)
    animation_forbidden: bool = True


class ProtectiveBehaviorEngine:
    def run_cycle(
        self,
        hazard: str,
        risk: float,
        growth_stage: str = "infant",
        prior_success: float = 0.5,
    ) -> ProtectionCycle:
        if not (0.0 <= risk <= 1.0):
            raise ValueError("risk must be within [0, 1]")
        # 成長越大，協助越少（非永遠限制）
        stage_assist = {
            "infant": 0.95, "toddler": 0.75, "child": 0.45, "preteen": 0.25,
        }.get(growth_stage, 0.7)
        assistance = min(1.0, stage_assist * (0.6 + 0.4 * risk))

        if risk >= 0.7:
            action = "intervene_block_hazard"
            predicted = "prevent_contact"
            limited = True
        elif risk >= 0.4:
            action = "guide_away_or_spot"
            predicted = "reduce_exposure"
            limited = growth_stage in ("infant", "toddler")
        else:
            action = "monitor_nearby"
            predicted = "standby"
            limited = False

        hints = []
        if action.startswith("intervene"):
            hints += ["move_between_child_and_hazard", "redirect_attention"]
        elif action.startswith("guide"):
            hints += ["offer_hand", "verbal_cue_hook"]
        else:
            hints += ["maintain_proximal_vigilance"]

        # 觀察結果簡化：高協助＋先驗成功 → 較佳
        outcome = "safe" if risk * (1.0 - 0.5 * assistance) < 0.35 else "needs_followup"

        return ProtectionCycle(
            detected=hazard,
            assessed_risk=risk,
            predicted=predicted,
            action=action,
            observed_outcome=outcome,
            memory_written=True,
            limited_autonomy_temporarily=limited,
            assistance_level=assistance,
            motor_hints=hints,
        )
