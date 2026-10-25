"""愛與依附強度（依關係類型：浪漫／育幼／友誼／責任）。"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict


class LoveType(str, Enum):
    ROMANTIC = "romantic"
    MATERNAL = "maternal"
    FRIENDSHIP = "friendship"
    DUTY = "duty"
    COMPASSION = "compassion"


@dataclass
class LoveBond:
    target_id: str
    love_type: LoveType
    strength: float
    trust: float
    responsibility: float


class LoveAttachmentEngine:
    def __init__(self) -> None:
        self.bonds: Dict[str, LoveBond] = {}

    def set_bond(
        self, target_id: str, love_type: LoveType,
        strength: float, trust: float = 0.5, responsibility: float = 0.3,
    ) -> LoveBond:
        for v in (strength, trust, responsibility):
            if not (0.0 <= v <= 1.0):
                raise ValueError("values must be within [0, 1]")
        b = LoveBond(target_id, love_type, strength, trust, responsibility)
        self.bonds[target_id] = b
        return b

    def get(self, target_id: str) -> LoveBond | None:
        return self.bonds.get(target_id)

    def protective_weight(self, target_id: str) -> float:
        """不同愛類型不同規則。"""
        b = self.bonds.get(target_id)
        if not b:
            return 0.0
        type_w = {
            LoveType.MATERNAL: 1.15,
            LoveType.ROMANTIC: 1.0,
            LoveType.FRIENDSHIP: 0.75,
            LoveType.DUTY: 0.9,
            LoveType.COMPASSION: 0.65,
        }[b.love_type]
        return min(1.5, type_w * (0.5 * b.strength + 0.3 * b.trust + 0.2 * b.responsibility))
