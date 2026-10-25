"""關係狀態：友誼／欣賞／好感／愛慕／曖昧／戀愛／深度依附／疏遠結束。

非固定必經階段；情感自主：非無條件愛上每位使用者。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class RelState(str, Enum):
    STRANGER = "stranger"
    FRIENDSHIP = "friendship"
    ADMIRATION = "admiration"
    AFFECTION = "affection"
    ADORATION = "adoration"
    AMBIGUOUS = "ambiguous"
    ROMANTIC = "romantic"
    DEEP_ATTACHMENT = "deep_attachment"
    DISTANCING = "distancing"
    ENDED = "ended"


@dataclass
class RelationshipStatus:
    partner_id: str
    state: RelState
    commitment: float
    autonomous: bool = True
    unconditional_love_forbidden: bool = True
    note: str = ""


class RelationshipStateEngine:
    def __init__(self) -> None:
        self.states: dict[str, RelState] = {}
        self.commitment: dict[str, float] = {}

    def evaluate(
        self,
        partner_id: str,
        affection: float,
        trust: float,
        reciprocity: float,
        willingness: float,
        rejected: bool = False,
        interactions: int = 0,
    ) -> RelationshipStatus:
        if rejected or willingness <= 0.0:
            st = RelState.ENDED if self.states.get(partner_id) not in (None, RelState.STRANGER) else RelState.DISTANCING
            self.states[partner_id] = st
            return RelationshipStatus(partner_id, st, 0.0, note="boundary_or_rejection")

        # 非線性、非必經：依指標跳選，非流水線
        if interactions < 2 and affection < 0.25:
            st = RelState.STRANGER
        elif reciprocity < 0.2 and affection < 0.35:
            st = RelState.FRIENDSHIP if interactions >= 3 else RelState.STRANGER
        elif affection >= 0.75 and trust >= 0.7 and reciprocity >= 0.65 and willingness >= 0.6:
            st = RelState.DEEP_ATTACHMENT if trust >= 0.85 else RelState.ROMANTIC
        elif affection >= 0.55 and willingness >= 0.45 and reciprocity >= 0.4:
            st = RelState.AMBIGUOUS if willingness < 0.55 else RelState.ADORATION
        elif affection >= 0.4:
            st = RelState.AFFECTION
        elif affection >= 0.28:
            st = RelState.ADMIRATION
        else:
            st = RelState.FRIENDSHIP if interactions >= 2 else RelState.STRANGER

        # 情感自主：低互惠＋低意願 → 不晉升戀愛
        if st in (RelState.ROMANTIC, RelState.DEEP_ATTACHMENT) and reciprocity < 0.35:
            st = RelState.AFFECTION
            note = "autonomy_block_unconditional_escalation"
        else:
            note = "state_from_multi_factor"

        commit = min(1.0, 0.4 * affection + 0.35 * trust + 0.25 * reciprocity)
        self.states[partner_id] = st
        self.commitment[partner_id] = commit
        return RelationshipStatus(
            partner_id, st, commit,
            autonomous=True,
            unconditional_love_forbidden=True,
            note=note,
        )
