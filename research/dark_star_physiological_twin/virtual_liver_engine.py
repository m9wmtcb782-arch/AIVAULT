"""肝臟：肝醣、葡萄糖調節與物質代謝代理。approximation。"""
from __future__ import annotations

from dataclasses import dataclass

from .units import clamp, clamp01


@dataclass
class LiverState:
    glycogen_g: float = 100.0
    detox_load: float = 0.0
    function: float = 1.0


class VirtualLiverEngine:
    def __init__(self) -> None:
        self.state = LiverState()

    def step(self, dt: float, glycogen_g: float, glucagon_au: float, insulin_au: float) -> LiverState:
        s = self.state
        s.glycogen_g = glycogen_g
        s.detox_load = max(0.0, s.detox_load - 0.01 * dt * s.function)
        # 功能受極度低血糖／高解毒負荷影響
        stress = clamp01(s.detox_load + max(0.0, 1.2 - insulin_au) * 0.1)
        s.function = clamp(1.0 - 0.3 * stress, 0.3, 1.0)
        return s
