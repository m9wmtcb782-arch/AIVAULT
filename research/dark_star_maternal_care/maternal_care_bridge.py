"""育幼橋接：接痛覺／危險預測、情緒生理、長期記憶、視聽、動作、決策。

理解「他人」傷害線索用於照顧（非僅自身痛覺）。
可選接 dark_star_nociception.DangerMemoryEngine。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .attachment_memory_engine import AttachmentMemoryEngine
from .care_motivation_engine import CareMotivation, CareMotivationEngine
from .developmental_learning_engine import DevelopmentalLearningEngine
from .infant_signal_engine import (
    CueType,
    GrowthStage,
    InfantSignal,
    InfantSignalEngine,
)
from .maternal_neural_engine import MaternalNeuralEngine
from .protective_behavior_engine import ProtectionCycle, ProtectiveBehaviorEngine


@dataclass
class CareTickResult:
    signal: Optional[InfantSignal]
    motivation: CareMotivation
    protection: Optional[ProtectionCycle]
    strategy: dict
    neural_readiness: float
    other_harm_inferred: bool
    memory_snapshot_size: int
    pending_research: List[str] = field(default_factory=lambda: [
        "audiovisual_cry_classifier",
        "realtime_avatar_soothe_motion",
        "cross_agent_world_model_sync",
    ])


class MaternalCareBridge:
    def __init__(self, danger_memory: Any = None) -> None:
        self.neural = MaternalNeuralEngine()
        self.signals = InfantSignalEngine()
        self.memory = AttachmentMemoryEngine()
        self.motivation = CareMotivationEngine()
        self.protect = ProtectiveBehaviorEngine()
        self.devel = DevelopmentalLearningEngine()
        self.danger_memory = danger_memory  # optional DangerMemoryEngine

    def bind_child(self, identity_id: str, name: str = "", stage: GrowthStage = GrowthStage.INFANT) -> None:
        self.memory.get_or_create(identity_id, name)
        self.memory.set_growth(identity_id, stage.value)
        self.signals.set_stage(stage)

    def infer_other_harm(self, cues: dict) -> bool:
        """他人傷害線索（跌倒姿態、哭聲突變等）— 不用於自我痛表演。"""
        return bool(cues.get("fall_detected") or cues.get("injury_hint")
                    or cues.get("pain_expression_other"))

    def tick(
        self,
        identity_id: str,
        cue: Optional[CueType] = None,
        intensity: float = 0.0,
        context: Optional[dict] = None,
        hazard: Optional[str] = None,
        hazard_risk: float = 0.0,
        care_success: float = 0.0,
    ) -> CareTickResult:
        ctx = dict(context or {})
        profile = self.memory.get_or_create(identity_id)
        stage = GrowthStage(profile.growth_stage)

        signal = None
        if cue is not None:
            self.signals.set_stage(stage)
            signal = self.signals.observe(cue, intensity, ctx)

        other_harm = self.infer_other_harm(ctx)
        distress = intensity if cue in (CueType.CRY, CueType.FEAR, CueType.SEEK_COMFORT) else 0.0
        threat = hazard_risk if hazard else (0.6 if other_harm else 0.0)

        neural = self.neural.update(
            infant_distress=distress,
            care_success=care_success,
            proximity=float(ctx.get("proximity", 0.5)),
            familiar_bond=profile.bond_strength,
            threat_to_infant=threat,
        )
        readiness = self.neural.care_readiness()
        mot = self.motivation.evaluate(neural, signal, profile, readiness)

        protection = None
        # 危險預測：可併痛覺物件記憶
        if hazard:
            risk = hazard_risk
            if self.danger_memory is not None and hasattr(self.danger_memory, "predict_object_risk"):
                risk = max(risk, self.danger_memory.predict_object_risk(hazard))
            protection = self.protect.run_cycle(hazard, risk, profile.growth_stage)
            if protection.memory_written:
                self.memory.record_protection(identity_id, hazard, protection.observed_outcome)

        # 安撫學習
        if cue == CueType.CRY and care_success > 0:
            action = self.memory.best_soothing(identity_id) or "hold_and_sway"
            self.memory.record_care(identity_id, "cry", action, care_success)
        elif cue is not None and care_success > 0:
            self.memory.record_care(identity_id, cue.value, mot.priority, care_success)

        strategy = self.devel.adjust_action(stage, mot.priority)
        return CareTickResult(
            signal=signal,
            motivation=mot,
            protection=protection,
            strategy=strategy,
            neural_readiness=readiness,
            other_harm_inferred=other_harm,
            memory_snapshot_size=len(self.memory.persist_across_dialogue_end()),
        )
