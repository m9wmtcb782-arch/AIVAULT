"""內分泌簡化：胰島素／升糖素／皮質醇代理與壓力軸。hypothesis／可校準。"""
from __future__ import annotations

from dataclasses import dataclass

from .state import NeuralDrive
from .units import clamp, clamp01


@dataclass
class EndocrineState:
    insulin_au: float = 1.0
    glucagon_au: float = 1.0
    cortisol_au: float = 1.0
    adrenaline_au: float = 1.0
    function: float = 1.0


class VirtualEndocrineEngine:
    def __init__(self) -> None:
        self.state = EndocrineState()

    def step(
        self,
        dt: float,
        glucose_mg_dl: float,
        drive: NeuralDrive,
        insulin_au: float,
        glucagon_au: float,
    ) -> EndocrineState:
        s = self.state
        s.insulin_au = insulin_au
        s.glucagon_au = glucagon_au
        stress = clamp01(drive.fear_autonomic + 0.5 * drive.pain_intensity + 0.3 * drive.motor_intensity)
        # 一階
        alpha = 1.0 - pow(0.5, dt / 5.0)
        cort_t = 1.0 + 1.5 * stress
        adr_t = 1.0 + 2.0 * stress + 1.0 * drive.motor_intensity
        s.cortisol_au += (cort_t - s.cortisol_au) * alpha
        s.adrenaline_au += (adr_t - s.adrenaline_au) * alpha
        s.function = 1.0
        return s
