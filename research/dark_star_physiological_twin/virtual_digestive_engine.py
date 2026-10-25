"""胃腸道：消化、吸收、飢餓／飽足訊號。approximation。"""
from __future__ import annotations

from dataclasses import dataclass

from .units import clamp01


@dataclass
class DigestiveState:
    gastric_content_g: float = 0.0
    absorption_rate_g_s: float = 0.0
    hunger_signal: float = 0.2
    satiety_signal: float = 0.5
    function: float = 1.0


class VirtualDigestiveEngine:
    def __init__(self) -> None:
        self.state = DigestiveState()

    def eat(self, grams: float) -> None:
        self.state.gastric_content_g += max(0.0, grams)

    def step(self, dt: float, hunger_from_metabolism: float) -> DigestiveState:
        s = self.state
        absorb = min(s.gastric_content_g, 0.15 * dt * s.function)
        s.gastric_content_g -= absorb
        s.absorption_rate_g_s = absorb / max(dt, 1e-6)
        s.satiety_signal = clamp01(0.2 + s.gastric_content_g / 400.0)
        s.hunger_signal = clamp01(0.7 * hunger_from_metabolism + 0.3 * (1.0 - s.satiety_signal))
        return s
