"""浪漫行為橋接：接神經／內分泌／喚起／視線語音動作／長期記憶／決策。

禁隔離戀愛聊天機器人；禁固定情話／動畫。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from .affection_engine import AffectionEngine
from .attraction_model import AttractionFactors
from .attachment_memory_engine import AttachmentMemoryEngine
from .emotional_arousal_engine import ArousalOutput, EmotionalArousalEngine
from .flirting_context_engine import FlirtContext, FlirtingContextEngine
from .relationship_state_engine import RelationshipStateEngine, RelationshipStatus
from .romantic_neural_engine import RomanticNeuralEngine


@dataclass
class RomanticTick:
    partner_id: str
    affection: float
    neural_drive: float
    flirt: FlirtContext
    relationship: RelationshipStatus
    arousal: ArousalOutput
    canned_lines_forbidden: bool = True
    isolated_chatbot_forbidden: bool = True
    pending_research: List[str] = field(default_factory=lambda: [
        "prosody_realtime_hooks",
        "gaze_engine_15_wiring",
        "encrypted_private_store",
    ])


class RomanticBehaviorBridge:
    def __init__(self) -> None:
        self.neural = RomanticNeuralEngine()
        self.affection = AffectionEngine()
        self.flirt = FlirtingContextEngine()
        self.memory = AttachmentMemoryEngine()
        self.arousal = EmotionalArousalEngine()
        self.relationship = RelationshipStateEngine()

    def tick(
        self,
        partner_id: str,
        factors: AttractionFactors,
        user_cue: str = "neutral",
        reciprocity: float = 0.3,
        warmth: float = 0.2,
        novelty: float = 0.2,
        explicit_no: bool = False,
        smile: bool = False,
        eye_contact: bool = False,
        shy: float = 0.2,
    ) -> RomanticTick:
        aff_st = self.affection.update(partner_id, factors, delta_warmth=warmth)
        mem = self.memory.get(partner_id)
        rejection = 1.0 if explicit_no else 0.0
        neural = self.neural.update(
            novelty=novelty,
            reciprocity=reciprocity,
            trust=mem.trust,
            warmth=warmth,
            rejection_signal=rejection,
            safety=factors.trust_safety,
        )
        drive = self.neural.attraction_drive()
        ctx = self.flirt.interpret(
            user_cue, reciprocity, aff_st.affection,
            explicit_no=explicit_no, smile=smile, eye_contact=eye_contact,
        )
        rel = self.relationship.evaluate(
            partner_id,
            affection=aff_st.affection,
            trust=mem.trust,
            reciprocity=reciprocity,
            willingness=ctx.self_willingness,
            rejected=explicit_no or not ctx.allow_pursue and ctx.perceived_intent.value == "boundary_no",
            interactions=aff_st.interaction_n,
        )
        aro = self.arousal.compute(
            autonomic=neural.autonomic_arousal,
            affection=aff_st.affection,
            uncertainty=ctx.uncertainty,
            rejection=rejection,
            shy=shy,
        )
        if warmth > 0 and not explicit_no:
            self.memory.record_event(partner_id, f"warm_interact:{user_cue}", trust_delta=0.02 * reciprocity)
            self.memory.record_emotion(partner_id, "warm", valence=0.3 + warmth * 0.4, arousal=neural.autonomic_arousal)
        return RomanticTick(
            partner_id=partner_id,
            affection=aff_st.affection,
            neural_drive=drive,
            flirt=ctx,
            relationship=rel,
            arousal=aro,
        )
