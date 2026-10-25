"""腎臟：水分、電解質及廢物平衡（簡化）。approximation。"""
from __future__ import annotations

from dataclasses import dataclass

from .units import clamp, clamp01


@dataclass
class RenalState:
    gfr_proxy: float = 1.0
    urine_output_ml_min: float = 1.0
    na_mmol_l: float = 140.0
    k_mmol_l: float = 4.0
    waste: float = 0.1
    function: float = 1.0


class VirtualRenalEngine:
    def __init__(self) -> None:
        self.state = RenalState()

    def step(
        self,
        dt: float,
        hydration: float,
        map_mmhg: float,
        kidney_flow_l_min: float,
    ) -> RenalState:
        s = self.state
        perf = clamp01(kidney_flow_l_min / 1.0) * clamp01(map_mmhg / 90.0)
        s.gfr_proxy = clamp(perf * s.function, 0.1, 1.2)
        s.urine_output_ml_min = 0.5 + 1.5 * hydration * s.gfr_proxy
        # 脫水 → Na 濃縮代理
        s.na_mmol_l = clamp(140.0 + 10.0 * (1.0 - hydration), 125.0, 155.0)
        s.k_mmol_l = clamp(4.0 + 0.5 * (1.0 - s.gfr_proxy), 3.0, 6.0)
        s.waste = clamp01(s.waste + 0.002 * dt - 0.003 * dt * s.gfr_proxy)
        if map_mmhg < 70:
            s.function = max(0.4, s.function - 0.01 * dt)
        else:
            s.function = min(1.0, s.function + 0.005 * dt)
        return s
