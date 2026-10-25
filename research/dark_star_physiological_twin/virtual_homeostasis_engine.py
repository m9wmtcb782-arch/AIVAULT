"""Homeostasis Engine：負回饋、偏差偵測、適應模式。

控制變數：體溫、血糖、血壓、血氧、水分、電解質、能量、疲勞。
模式：normal_adaptation | acute_stress | sustained_imbalance
證據：approximation。
"""
from __future__ import annotations

from dataclasses import dataclass

from .state import HomeostasisState
from .units import clamp, clamp01


@dataclass
class Setpoints:
    core_temp_c: float = 37.0
    glucose_mg_dl: float = 90.0
    map_mmhg: float = 93.0
    spo2: float = 0.98
    hydration: float = 1.0
    na_mmol_l: float = 140.0
    k_mmol_l: float = 4.0
    energy_reserve_norm: float = 1.0
    fatigue: float = 0.1


class VirtualHomeostasisEngine:
    def __init__(self, setpoints: Setpoints | None = None) -> None:
        self.setpoints = setpoints or Setpoints()
        self.state = HomeostasisState()
        self._stress_timer_s = 0.0
        self._imbalance_timer_s = 0.0

    def step(
        self,
        dt: float,
        core_temp_c: float,
        glucose_mg_dl: float,
        map_mmhg: float,
        spo2: float,
        hydration: float,
        na_mmol_l: float,
        k_mmol_l: float,
        energy_reserve_norm: float,
        fatigue: float,
        external_stress: float = 0.0,
    ) -> HomeostasisState:
        sp = self.setpoints
        s = self.state
        s.core_temp_c = core_temp_c
        s.glucose_mg_dl = glucose_mg_dl
        s.map_mmhg = map_mmhg
        s.spo2 = spo2
        s.hydration = hydration
        s.na_mmol_l = na_mmol_l
        s.k_mmol_l = k_mmol_l
        s.energy_reserve_norm = energy_reserve_norm
        s.fatigue = fatigue

        # 偏差分數
        errs = [
            abs(core_temp_c - sp.core_temp_c) / 2.0,
            abs(glucose_mg_dl - sp.glucose_mg_dl) / 40.0,
            abs(map_mmhg - sp.map_mmhg) / 30.0,
            abs(spo2 - sp.spo2) / 0.1,
            abs(hydration - sp.hydration) / 0.3,
            abs(energy_reserve_norm - 1.0) / 0.5,
            max(0.0, fatigue - 0.5) / 0.5,
            external_stress,
        ]
        deviation = clamp01(sum(errs) / len(errs))

        if deviation < 0.2 and external_stress < 0.25:
            self._stress_timer_s = max(0.0, self._stress_timer_s - dt)
            self._imbalance_timer_s = max(0.0, self._imbalance_timer_s - dt)
            s.mode = "normal_adaptation"
        elif deviation < 0.55:
            self._stress_timer_s += dt
            self._imbalance_timer_s = max(0.0, self._imbalance_timer_s - 0.5 * dt)
            s.mode = "acute_stress"
        else:
            self._imbalance_timer_s += dt
            s.mode = "sustained_imbalance" if self._imbalance_timer_s > 30.0 else "acute_stress"

        s.deviation = deviation  # type: ignore[attr-defined]
        return s

    def feedback_adjustments(self) -> dict:
        """負回饋建議（供 orchestrator 微調驅動）。"""
        s = self.state
        sp = self.setpoints
        return {
            "thirst_drive": clamp01((sp.hydration - s.hydration) * 2.0),
            "eat_drive": clamp01((sp.glucose_mg_dl - s.glucose_mg_dl) / 40.0),
            "rest_drive": clamp01(s.fatigue - 0.4),
            "cool_drive": clamp01(s.core_temp_c - 37.2),
            "cardio_support": clamp01((sp.map_mmhg - s.map_mmhg) / 40.0),
        }
