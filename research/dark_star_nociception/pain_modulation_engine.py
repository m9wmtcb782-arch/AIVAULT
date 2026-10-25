"""疼痛調制引擎：下行抑制／促進、情境、壓力、注意力。"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ModulationState:
    descending: float = 0.0      # [-0.5, 0.5] 正＝鎮痛
    stress: float = 0.3          # 壓力可促進痛
    attention_focus: float = 0.5 # 注意力集中於痛 → 主觀↑
    placebo_like: float = 0.0    # 研究用期望效應近似
    evidence_tier: str = "approximation"


class PainModulationEngine:
    def __init__(self) -> None:
        self.state = ModulationState()

    def set(
        self,
        descending: float | None = None,
        stress: float | None = None,
        attention_focus: float | None = None,
        placebo_like: float | None = None,
    ) -> ModulationState:
        s = self.state
        if descending is not None:
            if not (-0.5 <= descending <= 0.5):
                raise ValueError("descending out of range")
            s.descending = descending
        if stress is not None:
            s.stress = max(0.0, min(1.0, stress))
        if attention_focus is not None:
            s.attention_focus = max(0.0, min(1.0, attention_focus))
        if placebo_like is not None:
            s.placebo_like = max(0.0, min(1.0, placebo_like))
        return s

    def net_gain(self) -> float:
        """回傳用於縮放連續痛訊號的淨增益（約 0.4～1.4）。"""
        s = self.state
        # 下行正值降低痛；壓力與注意力提高；安慰劑降低
        gain = 1.0 - s.descending * 0.8 + s.stress * 0.25 + s.attention_focus * 0.15 - s.placebo_like * 0.3
        return max(0.4, min(1.4, gain))

    def descending_for_neural(self) -> float:
        return self.state.descending
