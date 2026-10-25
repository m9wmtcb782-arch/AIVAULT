"""求生本能：接痛覺；完整性／能量／傷後能力／逃險／危險記憶／恢復。

求生重要但非永遠只顧自己。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class SurvivalState:
    integrity: float = 1.0       # 身體完整性
    energy: float = 1.0
    fatigue: float = 0.0
    pain_level: float = 0.0
    post_injury_capability: float = 1.0
    escape_drive: float = 0.0
    self_priority: float = 0.55  # 非永遠 1.0
    evidence_tier: str = "approximation"


class SurvivalInstinctEngine:
    def __init__(self, nociception_core: Any = None) -> None:
        self.nociception = nociception_core
        self.state = SurvivalState()

    def update_from_threat(
        self,
        severity: float,
        pain: float = 0.0,
        injury: float = 0.0,
        known_object_risk: float = 0.0,
    ) -> SurvivalState:
        s = self.state
        s.pain_level = max(s.pain_level * 0.8, pain)
        s.integrity = max(0.05, s.integrity - injury * 0.3)
        s.post_injury_capability = max(0.1, s.integrity * (1.0 - 0.5 * s.pain_level))
        s.escape_drive = min(1.0, 0.5 * severity + 0.3 * known_object_risk + 0.3 * s.pain_level)
        s.energy = max(0.05, s.energy - 0.05 * severity)
        s.fatigue = min(1.0, 1.0 - s.energy)
        # 求生權重上升但不鎖死為只顧自己
        s.self_priority = min(0.9, 0.45 + 0.4 * s.escape_drive)
        return s

    def pull_danger_memory(self, object_id: str) -> float:
        if self.nociception is not None and hasattr(self.nociception, "danger"):
            return self.nociception.danger.predict_object_risk(object_id)
        return 0.0

    def recover(self, fraction: float = 0.1) -> None:
        s = self.state
        s.integrity = min(1.0, s.integrity + fraction * 0.5)
        s.energy = min(1.0, s.energy + fraction)
        s.fatigue = max(0.0, s.fatigue - fraction)
        s.pain_level *= (1 - fraction)
        s.post_injury_capability = max(0.1, s.integrity * (1.0 - 0.5 * s.pain_level))
