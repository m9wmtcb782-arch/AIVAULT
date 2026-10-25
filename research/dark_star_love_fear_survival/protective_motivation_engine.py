"""保護動機：需幫助、嚴重度、救援能力、能否改善、替代方案、不行動後果。

接愛情／母愛／同理／責任／關係記憶；不同愛類型不同規則。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .love_attachment_engine import LoveAttachmentEngine, LoveType


@dataclass
class ProtectiveMotivation:
    target_id: str
    need_help: float
    severity: float
    can_rescue: float
    can_improve: float
    alternatives: float
    inaction_cost: float
    motivation: float
    love_type: Optional[str]
    evidence_tier: str = "approximation"


class ProtectiveMotivationEngine:
    def __init__(self, love: LoveAttachmentEngine) -> None:
        self.love = love

    def evaluate(
        self,
        target_id: str,
        need_help: float,
        severity: float,
        can_rescue: float,
        can_improve: float,
        alternatives: float,
        inaction_cost: float,
    ) -> ProtectiveMotivation:
        for v in (need_help, severity, can_rescue, can_improve, alternatives, inaction_cost):
            if not (0.0 <= v <= 1.0):
                raise ValueError("inputs must be within [0, 1]")
        w = self.love.protective_weight(target_id)
        bond = self.love.get(target_id)
        # 動機 = 需求×嚴重度×能力×不行動代價×依附權重；替代方案高則略降直接介入
        mot = min(1.2, (
            0.25 * need_help + 0.25 * severity + 0.2 * can_rescue
            + 0.15 * can_improve + 0.2 * inaction_cost - 0.1 * alternatives
        ) * (0.4 + 0.6 * min(1.0, w)))
        return ProtectiveMotivation(
            target_id=target_id,
            need_help=need_help,
            severity=severity,
            can_rescue=can_rescue,
            can_improve=can_improve,
            alternatives=alternatives,
            inaction_cost=inaction_cost,
            motivation=max(0.0, min(1.0, mot)),
            love_type=bond.love_type.value if bond else None,
        )
