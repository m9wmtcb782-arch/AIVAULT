"""照顧動機引擎：由神經狀態、依附記憶、幼兒訊號共同決定動機強度與優先級。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .infant_signal_engine import InfantSignal
from .maternal_neural_engine import MaternalNeuralState
from .attachment_memory_engine import AttachteeProfile


@dataclass
class CareMotivation:
    intensity: float
    priority: str          # monitor | soothe | assist | protect | step_back
    target_id: str
    reason_codes: list
    allow_autonomy: bool   # 照顧 ≠ 永遠限制
    evidence_tier: str = "approximation"


class CareMotivationEngine:
    def evaluate(
        self,
        neural: MaternalNeuralState,
        signal: Optional[InfantSignal],
        profile: Optional[AttachteeProfile],
        readiness: float,
    ) -> CareMotivation:
        target = profile.identity_id if profile else "unknown"
        bond = profile.bond_strength if profile else 0.0
        reasons = []
        intensity = readiness * 0.5 + bond * 0.2
        priority = "monitor"
        allow_autonomy = True

        if signal:
            intensity = min(1.0, intensity + signal.intensity * 0.4)
            if signal.cue.value == "danger_near" or signal.cue.value == "fall_risk":
                priority = "protect"
                allow_autonomy = False  # 危險當下暫限制
                reasons.append("hazard_salience")
            elif signal.cue.value in ("cry", "seek_comfort", "fear"):
                priority = "soothe"
                reasons.append("distress_cue")
            elif signal.cue.value == "injury_hint":
                priority = "assist"
                reasons.append("injury_hint")
            else:
                priority = "monitor"
                reasons.append("general_cue")
            if signal.uncertainty > 0.55:
                reasons.append("high_uncertainty_explore_gently")

        # 成長較大 → 更多自主
        stage = profile.growth_stage if profile else "infant"
        if stage in ("child", "preteen") and priority != "protect":
            allow_autonomy = True
            if priority == "soothe" and intensity < 0.7:
                priority = "assist"
                reasons.append("age_appropriate_step_back")

        if neural.fatigue > 0.7:
            intensity *= 0.7
            reasons.append("caregiver_fatigue")

        return CareMotivation(
            intensity=max(0.0, min(1.0, intensity)),
            priority=priority,
            target_id=target,
            reason_codes=reasons,
            allow_autonomy=allow_autonomy,
        )
