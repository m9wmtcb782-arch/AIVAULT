"""能量與物質平衡｜葡萄糖／肝醣／脂肪、BMR、運動、疲勞、飢餓。

胰島素／升糖素簡化可校準；能量守恆（有來源與去向）。
證據：approximation／hypothesis（胰島素參數可校準）。
"""
from __future__ import annotations

from dataclasses import dataclass

from .state import MetabolismState, NeuralDrive
from .units import SEC_PER_DAY, clamp, clamp01


@dataclass
class MetabolismParams:
    bmr_kcal_day: float = 1400.0
    glycogen_max_g: float = 120.0
    glucose_setpoint: float = 90.0
    insulin_sensitivity: float = 1.0
    glucagon_sensitivity: float = 1.0
    # kcal per g
    kcal_per_g_glycogen: float = 4.0
    kcal_per_g_fat: float = 9.0
    exercise_kcal_per_min_at_1: float = 12.0  # 全力運動


class VirtualMetabolismEngine:
    def __init__(self, params: MetabolismParams | None = None) -> None:
        self.params = params or MetabolismParams()
        self.state = MetabolismState(
            bmr_kcal_day=self.params.bmr_kcal_day,
            glycogen_g=100.0,
            fat_energy_kcal=80000.0,
        )
        self._energy_in_kcal = 0.0
        self._energy_out_kcal = 0.0

    def ingest(self, glucose_g: float = 0.0, fat_kcal: float = 0.0) -> None:
        self.state.glucose_mg_dl += glucose_g * 3.0  # 粗略
        self.state.fat_energy_kcal += fat_kcal
        self._energy_in_kcal += glucose_g * 4.0 + fat_kcal

    def step(self, dt: float, drive: NeuralDrive, core_temp_c: float = 37.0) -> MetabolismState:
        p = self.params
        s = self.state
        motor = clamp01(drive.motor_intensity)

        # 能量消耗
        bmr_per_s = p.bmr_kcal_day / SEC_PER_DAY
        ex_per_s = (p.exercise_kcal_per_min_at_1 * motor) / 60.0
        # 體溫偏離輕微增加消耗
        therm = 0.002 * abs(core_temp_c - 37.0)
        burn = (bmr_per_s + ex_per_s + therm) * dt
        s.exercise_kcal_min = p.exercise_kcal_per_min_at_1 * motor

        # 優先肝醣／葡萄糖，再脂肪
        # 可動用血糖能量代理（工程尺度，非臨床）
        glucose_pool_kcal = max(0.0, (s.glucose_mg_dl - 55.0) * 0.05)
        from_glucose = min(burn * 0.55, glucose_pool_kcal)
        remain = burn - from_glucose
        from_glycogen = min(remain * 0.7, s.glycogen_g * p.kcal_per_g_glycogen)
        remain2 = max(0.0, remain - from_glycogen)
        from_fat = min(remain2, s.fat_energy_kcal)

        if from_glucose > 0:
            s.glucose_mg_dl -= from_glucose / 0.05
        s.glycogen_g = max(0.0, s.glycogen_g - from_glycogen / p.kcal_per_g_glycogen)
        s.fat_energy_kcal = max(0.0, s.fat_energy_kcal - from_fat)
        actual_out = from_glucose + from_glycogen + from_fat
        # 若儲備不足，實際消耗小於需求 → 疲勞稍後上升（不憑空造能）
        self._energy_out_kcal += actual_out

        # 胰島素／升糖素簡化
        err = s.glucose_mg_dl - p.glucose_setpoint
        s.insulin_au = clamp(1.0 + 0.02 * err * p.insulin_sensitivity, 0.2, 5.0)
        s.glucagon_au = clamp(1.0 - 0.02 * err * p.glucagon_sensitivity, 0.2, 5.0)
        # 肝醣 ↔ 血糖
        if s.insulin_au > 1.2 and s.glucose_mg_dl > 100 and s.glycogen_g < p.glycogen_max_g:
            move = min(0.02 * dt * s.insulin_au, (s.glucose_mg_dl - 90) * 0.01)
            s.glycogen_g += move
            s.glucose_mg_dl -= move * 2.0
        if s.glucagon_au > 1.1 and s.glucose_mg_dl < 85 and s.glycogen_g > 0:
            move = min(0.03 * dt * s.glucagon_au, s.glycogen_g)
            s.glycogen_g -= move
            s.glucose_mg_dl += move * 2.0

        s.glucose_mg_dl = clamp(s.glucose_mg_dl, 40.0, 400.0)
        s.glycogen_g = clamp(s.glycogen_g, 0.0, p.glycogen_max_g)

        # 疲勞：運動累積、低血糖、低儲備
        reserve = s.glycogen_g / p.glycogen_max_g + s.fat_energy_kcal / 80000.0
        fatigue_dot = 0.02 * motor + 0.01 * max(0.0, 70.0 - s.glucose_mg_dl) / 70.0
        recover = 0.008 * (1.0 - motor) * (0.5 + 0.5 * clamp01(reserve))
        s.fatigue = clamp01(s.fatigue + fatigue_dot * dt - recover * dt)

        s.hunger = clamp01(1.0 - s.glucose_mg_dl / 120.0 + 0.3 * (1.0 - s.glycogen_g / p.glycogen_max_g))
        s.satiety = clamp01(1.0 - s.hunger)
        s.heat_production_w = 80.0 + 400.0 * motor + 5.0 * (s.fatigue)
        s.energy_reserve_kcal = s.glycogen_g * p.kcal_per_g_glycogen + s.fat_energy_kcal
        s.bmr_kcal_day = p.bmr_kcal_day
        return s

    def vo2_demand_ml_min(self) -> float:
        """約 5 kcal ≈ 1 L O2 → ml/min。"""
        kcal_min = self.state.bmr_kcal_day / 1440.0 + self.state.exercise_kcal_min
        return max(150.0, kcal_min * 200.0)  # 粗略

    def energy_balance(self) -> dict:
        return {
            "in_kcal": self._energy_in_kcal,
            "out_kcal": self._energy_out_kcal,
            "store_kcal": self.state.energy_reserve_kcal,
        }
