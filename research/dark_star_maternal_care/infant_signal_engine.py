"""幼兒訊號引擎：哭聲／需求線索／危險／尋求安撫／成長階段。

結合情境＋不確定性，禁止武斷單一原因。
虛擬幼兒避免不必要傷害模擬。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class GrowthStage(str, Enum):
    INFANT = "infant"
    TODDLER = "toddler"
    CHILD = "child"
    PRETEEN = "preteen"


class CueType(str, Enum):
    CRY = "cry"
    HUNGER = "hunger"
    FATIGUE = "fatigue"
    FEAR = "fear"
    DISCOMFORT = "discomfort"
    FALL_RISK = "fall_risk"
    INJURY_HINT = "injury_hint"  # 輕度線索，非強制傷害模擬
    SEEK_COMFORT = "seek_comfort"
    DANGER_NEAR = "danger_near"
    PLAY = "play"


@dataclass
class InfantSignal:
    cue: CueType
    intensity: float
    stage: GrowthStage
    hypotheses: List[dict]          # [{cause, probability}]
    uncertainty: float              # 高＝勿武斷
    context: dict = field(default_factory=dict)
    evidence_tier: str = "approximation"


class InfantSignalEngine:
    def __init__(self, stage: GrowthStage = GrowthStage.INFANT) -> None:
        self.stage = stage

    def set_stage(self, stage: GrowthStage) -> None:
        self.stage = stage

    def observe(
        self,
        cue: CueType,
        intensity: float,
        context: Optional[dict] = None,
    ) -> InfantSignal:
        if not (0.0 <= intensity <= 1.0):
            raise ValueError("intensity must be within [0, 1]")
        ctx = dict(context or {})
        hyps = self._hypotheses(cue, intensity, ctx)
        # 不確定性：假設分散則高
        probs = [h["probability"] for h in hyps]
        top = max(probs) if probs else 0.0
        uncertainty = max(0.0, min(1.0, 1.0 - top + 0.15 * (len(hyps) - 1) / 3))
        return InfantSignal(
            cue=cue, intensity=intensity, stage=self.stage,
            hypotheses=hyps, uncertainty=uncertainty, context=ctx,
        )

    def _hypotheses(self, cue: CueType, intensity: float, ctx: dict) -> List[dict]:
        """多因假設，禁止單一武斷原因。"""
        if cue == CueType.CRY:
            base = [
                {"cause": "hunger", "probability": 0.28},
                {"cause": "fatigue", "probability": 0.22},
                {"cause": "discomfort", "probability": 0.18},
                {"cause": "fear", "probability": 0.12},
                {"cause": "seek_comfort", "probability": 0.20},
            ]
            if ctx.get("hours_since_feed", 0) > 3:
                base[0]["probability"] += 0.2
            if ctx.get("late_night"):
                base[1]["probability"] += 0.15
            if ctx.get("loud_noise"):
                base[3]["probability"] += 0.2
        elif cue == CueType.FALL_RISK:
            base = [
                {"cause": "unstable_posture", "probability": 0.45},
                {"cause": "obstacle", "probability": 0.25},
                {"cause": "exploration", "probability": 0.30},
            ]
        elif cue == CueType.DANGER_NEAR:
            base = [
                {"cause": "hot_object", "probability": 0.35},
                {"cause": "edge_drop", "probability": 0.30},
                {"cause": "unknown_threat", "probability": 0.35},
            ]
        elif cue == CueType.SEEK_COMFORT:
            base = [
                {"cause": "attachment_need", "probability": 0.5},
                {"cause": "fatigue", "probability": 0.25},
                {"cause": "mild_fear", "probability": 0.25},
            ]
        else:
            base = [{"cause": cue.value, "probability": 0.55},
                    {"cause": "other", "probability": 0.45}]
        # 正規化
        s = sum(h["probability"] for h in base) or 1.0
        for h in base:
            h["probability"] = round(h["probability"] / s, 3)
        return base

    def top_cause_not_certain(self, signal: InfantSignal, threshold: float = 0.7) -> bool:
        """若最高假設 < threshold，不得武斷單一原因。"""
        if not signal.hypotheses:
            return True
        return max(h["probability"] for h in signal.hypotheses) < threshold
