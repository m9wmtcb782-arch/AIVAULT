"""集中參數循環模型：心／肺／腦／肌／皮／腎／內臟。

質量守恆（血容量）、流量平衡（系統循環總和 ≈ CO）、合理範圍約束。
運動時肌肉血流再分配；脫水／失血影響血容量與阻力。
證據：approximation。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from .state import CirculationState, CompartmentFlow, NeuralDrive, circulation_defaults
from .units import clamp, clamp01


@dataclass
class CirculationParams:
    blood_volume_rest_l: float = 5.0
    min_brain_frac: float = 0.12
    max_muscle_frac: float = 0.70


class VirtualCirculationEngine:
    def __init__(self, params: CirculationParams | None = None) -> None:
        self.params = params or CirculationParams()
        self.state = CirculationState(
            compartments=circulation_defaults(),
            conserved_volume_l=self.params.blood_volume_rest_l,
        )
        self._bleed_l = 0.0
        self._water_deficit = 0.0  # 0～1

    @property
    def blood_volume_l(self) -> float:
        return max(2.0, self.params.blood_volume_rest_l * (1.0 - self._water_deficit) - self._bleed_l)

    def apply_dehydration(self, deficit: float) -> None:
        self._water_deficit = clamp01(deficit)

    def apply_blood_loss(self, liters: float) -> None:
        self._bleed_l = max(0.0, self._bleed_l + liters)

    def recover_volume(self, dt: float, rate_l_per_s: float = 0.00005) -> None:
        """緩慢液體／血容量恢復（簡化）。"""
        self._bleed_l = max(0.0, self._bleed_l - rate_l_per_s * dt)
        self._water_deficit = max(0.0, self._water_deficit - rate_l_per_s * 0.1 * dt)

    def step(self, dt: float, co_l_min: float, drive: NeuralDrive, spo2: float = 0.98) -> CirculationState:
        p = self.params
        vol = self.blood_volume_l
        self.state.conserved_volume_l = vol

        motor = clamp01(drive.motor_intensity)
        # 靜息系統分配（不含肺）
        base = {
            "heart": 0.04,
            "brain": 0.14,
            "muscle": 0.20,
            "skin": 0.08,
            "kidney": 0.20,
            "splanchnic": 0.24,
            "other": 0.10,
        }
        # 運動：肌肉↑，內臟／腎↓，腦維持
        muscle = clamp(base["muscle"] + 0.45 * motor, 0.15, p.max_muscle_frac)
        reduce = muscle - base["muscle"]
        splanchnic = max(0.05, base["splanchnic"] - 0.55 * reduce)
        kidney = max(0.08, base["kidney"] - 0.25 * reduce)
        skin = base["skin"] + 0.08 * motor  # 散熱
        heart = base["heart"] + 0.02 * motor
        brain = max(p.min_brain_frac, base["brain"])
        other = max(0.02, 1.0 - (muscle + splanchnic + kidney + skin + heart + brain))
        systemic = {
            "heart": heart,
            "brain": brain,
            "muscle": muscle,
            "skin": skin,
            "kidney": kidney,
            "splanchnic": splanchnic,
            "other": other,
        }
        # 正規化
        ssum = sum(systemic.values())
        systemic = {k: v / ssum for k, v in systemic.items()}

        comps: Dict[str, CompartmentFlow] = {}
        comps["lung"] = CompartmentFlow(
            name="lung",
            resistance=1.0,
            flow_l_min=co_l_min,
            o2_demand_ml_min=10.0,
            o2_supply_ml_min=co_l_min * 200.0 * spo2,  # 粗略 O2 攜帶代理
            mass_fraction=0.1 * (vol / p.blood_volume_rest_l),
        )
        # 代謝需求隨運動
        muscle_demand = 50.0 + 800.0 * motor
        total_demand = 250.0 + 700.0 * motor
        for k, frac in systemic.items():
            demand = {
                "muscle": muscle_demand,
                "brain": 50.0,
                "heart": 30.0 + 40.0 * motor,
                "kidney": 20.0,
                "splanchnic": 40.0 * (1.0 - 0.5 * motor),
                "skin": 10.0 + 30.0 * motor,
                "other": 20.0,
            }[k]
            flow = co_l_min * frac
            supply = flow * 200.0 * spo2 * (vol / p.blood_volume_rest_l)
            comps[k] = CompartmentFlow(
                name=k,
                resistance=1.0 / max(frac, 0.01),
                flow_l_min=flow,
                o2_demand_ml_min=demand,
                o2_supply_ml_min=supply,
                mass_fraction=frac * 0.9 * (vol / p.blood_volume_rest_l),
            )

        # 流量守恆檢查：系統總和 ≈ CO
        sys_flow = sum(c.flow_l_min for n, c in comps.items() if n != "lung")
        self.state.compartments = comps
        self.state.total_flow_l_min = sys_flow
        return self.state

    def systemic_flow_error(self, co: float) -> float:
        sys_flow = sum(c.flow_l_min for n, c in self.state.compartments.items() if n != "lung")
        return abs(sys_flow - co)
