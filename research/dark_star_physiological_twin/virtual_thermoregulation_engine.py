"""體溫調節：產熱、出汗、皮膚血流。approximation。"""
from __future__ import annotations

from dataclasses import dataclass

from .units import clamp


@dataclass
class ThermoState:
    core_temp_c: float = 37.0
    skin_temp_c: float = 33.5
    sweat_rate: float = 0.0
    skin_blood_flow_scale: float = 1.0


class VirtualThermoregulationEngine:
    def __init__(self) -> None:
        self.state = ThermoState()

    def step(
        self,
        dt: float,
        heat_production_w: float,
        skin_flow_l_min: float,
        ambient_c: float = 22.0,
        motor: float = 0.0,
    ) -> ThermoState:
        s = self.state
        # 極簡能量平衡：產熱 − 皮膚散熱
        loss = 5.0 * (s.core_temp_c - ambient_c) * (0.5 + 0.5 * skin_flow_l_min / 0.5)
        # W → °C 變化代理（熱容簡化）
        dT = (heat_production_w - loss) * 0.00015 * dt
        s.core_temp_c = clamp(s.core_temp_c + dT, 35.0, 41.0)
        s.sweat_rate = max(0.0, (s.core_temp_c - 37.0) * 0.4 + 0.2 * motor)
        s.skin_blood_flow_scale = clamp(1.0 + (s.core_temp_c - 37.0) * 0.5 + 0.3 * motor, 0.5, 2.5)
        s.skin_temp_c = clamp(0.6 * s.core_temp_c + 0.4 * ambient_c, 28.0, 38.0)
        return s
