"""曖昧／調情情境：友善 vs 浪漫、意願、誤解、拒絕界線。

禁把微笑／眼神＝愛情；禁強迫／操控／無限追求。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class IntentLabel(str, Enum):
    FRIENDLY = "friendly"
    PLAYFUL = "playful"
    ROMANTIC_HINT = "romantic_hint"
    CLEAR_INTEREST = "clear_interest"
    UNCERTAIN = "uncertain"
    BOUNDARY_NO = "boundary_no"
    MISREAD_RISK = "misread_risk"


@dataclass
class FlirtContext:
    perceived_intent: IntentLabel
    self_willingness: float          # 暗星繼續意願 [0,1]
    mutual_attraction_clue: float
    uncertainty: float
    smile_or_gaze_is_not_love: bool = True
    allow_pursue: bool = True
    force_forbidden: bool = True
    reasons: List[str] = field(default_factory=list)
    evidence_tier: str = "approximation"


class FlirtingContextEngine:
    def interpret(
        self,
        user_cue: str,
        reciprocity: float,
        affection: float,
        explicit_no: bool = False,
        smile: bool = False,
        eye_contact: bool = False,
    ) -> FlirtContext:
        reasons = []
        if explicit_no:
            return FlirtContext(
                perceived_intent=IntentLabel.BOUNDARY_NO,
                self_willingness=0.0,
                mutual_attraction_clue=0.0,
                uncertainty=0.0,
                allow_pursue=False,
                reasons=["explicit_rejection_stop"],
            )
        # 微笑／眼神不得自動＝愛情
        if (smile or eye_contact) and user_cue in ("", "neutral", "smile_only"):
            reasons.append("smile_or_gaze_alone_not_love")
            return FlirtContext(
                perceived_intent=IntentLabel.FRIENDLY,
                self_willingness=min(0.35, affection * 0.4),
                mutual_attraction_clue=0.15,
                uncertainty=0.6,
                reasons=reasons,
            )

        cue = user_cue.lower()
        if cue in ("joke", "tease"):
            intent = IntentLabel.PLAYFUL
            mutual = 0.3 * reciprocity
            uncertainty = 0.55
        elif cue in ("hint", "compliment_warm"):
            intent = IntentLabel.ROMANTIC_HINT
            mutual = 0.45 * reciprocity + 0.2 * affection
            uncertainty = 0.4
        elif cue in ("confess", "ask_out"):
            intent = IntentLabel.CLEAR_INTEREST
            mutual = 0.6 * reciprocity + 0.25 * affection
            uncertainty = 0.25
        else:
            intent = IntentLabel.UNCERTAIN
            mutual = 0.2 * reciprocity
            uncertainty = 0.7
            reasons.append("ambiguous_cue")

        willingness = max(0.0, min(1.0, affection * 0.5 + mutual * 0.4 - uncertainty * 0.2))
        # 無互惠時禁止無限追求
        allow = reciprocity >= 0.25 and willingness >= 0.2
        if not allow:
            reasons.append("no_infinite_pursuit_without_reciprocity")
        return FlirtContext(
            perceived_intent=intent,
            self_willingness=willingness,
            mutual_attraction_clue=min(1.0, mutual),
            uncertainty=uncertainty,
            allow_pursue=allow,
            reasons=reasons,
        )
