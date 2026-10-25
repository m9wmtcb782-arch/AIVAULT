"""虛擬呼吸系統｜與代謝／循環聯動。

RR, VT, VE, VA, VO2, VCO2, SpO2／組織氧；自主神經回饋。
禁止：血氧、呼吸頻率與心率彼此無關的固定數字。
證據：approximation。
"""
from __future__ import annotations

from dataclasses import dataclass

from .state import AutonomicTone, NeuralDrive, RespiratoryState
from .units import clamp, clamp01


@dataclass
class RespiratoryParams:
    rr_rest: float = 14.0
    vt_rest_l: float = 0.5
    vd_l: float = 0.15
    vo2_rest: float = 250.0
    vco2_rest: float = 200.0
    spo2_rest: float = 0.98


class VirtualRespiratoryEngine:
    def __init__(self, params: RespiratoryParams | None = None) -> None:
        self.params = params or RespiratoryParams()
        self.state = RespiratoryState(
            rr_per_min=self.params.rr_rest,
            vt_l=self.params.vt_rest_l,
            vd_l=self.params.vd_l,
            vo2_ml_min=self.params.vo2_rest,
            vco2_ml_min=self.params.vco2_rest,
            spo2=self.params.spo2_rest,
        )
        self._update_derived()

    def _update_derived(self) -> None:
        s = self.state
        s.ve_l_min = s.rr_per_min * s.vt_l
        s.va_l_min = s.rr_per_min * max(0.05, s.vt_l - s.vd_l)

    def step(
        self,
        dt: float,
        metabolic_vo2: float,
        co_l_min: float,
        autonomic: AutonomicTone,
        drive: NeuralDrive,
        circulation_o2_ok: float = 1.0,
    ) -> RespiratoryState:
        p = self.params
        s = self.state
        motor = clamp01(drive.motor_intensity)
        stress = clamp01(drive.fear_autonomic + 0.5 * drive.pain_intensity)

        # VO2／VCO2 跟隨代謝需求（與循環可供應耦合）
        vo2_demand = metabolic_vo2
        delivery_cap = co_l_min * 200.0 * circulation_o2_ok  # ml O2/min 粗略
        s.vo2_ml_min = min(vo2_demand, max(100.0, delivery_cap * 0.25))
        s.vco2_ml_min = s.vo2_ml_min * (0.8 + 0.05 * motor)  # RQ 近似

        # 通氣控制：代謝 + 交感
        ve_target = 7.0 + (s.vo2_ml_min - p.vo2_rest) / 50.0 + 8.0 * stress + 5.0 * (autonomic.sympathetic - 0.25)
        ve_target = clamp(ve_target, 4.0, 120.0)
        rr_target = p.rr_rest + 0.15 * (ve_target - 7.0) + 10.0 * stress + 12.0 * motor
        rr_target = clamp(rr_target, 8.0, 45.0)
        vt_target = clamp(ve_target / max(rr_target, 1.0), 0.3, 2.5)

        alpha = 1.0 - pow(0.5, dt / 3.0)
        s.rr_per_min += (rr_target - s.rr_per_min) * alpha
        s.vt_l += (vt_target - s.vt_l) * alpha
        self._update_derived()

        # SpO2：通氣／灌注不足時下降
        va_ok = clamp01(s.va_l_min / 4.5)
        perf_ok = clamp01(co_l_min / 5.0) * circulation_o2_ok
        spo2_target = clamp(0.97 * min(va_ok, 1.0) * (0.7 + 0.3 * perf_ok) + 0.02, 0.70, 0.99)
        # 極高需求且 CO 不足
        if vo2_demand > delivery_cap * 0.3:
            spo2_target -= 0.05 * motor
        s.spo2 += (clamp(spo2_target, 0.70, 0.99) - s.spo2) * alpha
        s.tissue_o2_fraction = clamp01(s.spo2 * perf_ok * 0.95 + 0.05)
        s.paco2_mmhg = clamp(40.0 * (4.9 / max(s.va_l_min, 1.0)), 25.0, 60.0)
        s.pao2_mmhg = clamp(100.0 * s.spo2 / 0.97, 50.0, 110.0)
        return s
