"""虛擬心血管數學模型。

CO = HR × SV
MAP ≈ CO × SVR + CVP

禁止：情緒標籤直接寫死固定心率。
證據：approximation（教科書集中參數）；非臨床診斷工具。
"""
from __future__ import annotations

from dataclasses import dataclass

from .state import AutonomicTone, CardioState, NeuralDrive
from .units import clamp, clamp01, co_l_per_min, map_mmhg


@dataclass
class CardioParams:
    hr_rest: float = 72.0
    hr_max: float = 185.0
    hr_min: float = 40.0
    sv_rest_ml: float = 70.0
    sv_max_ml: float = 120.0
    sv_min_ml: float = 35.0
    svr_rest: float = 17.5
    cvp_rest: float = 3.0
    blood_volume_rest_l: float = 5.0
    # 自主神經增益（可校準）
    sym_hr_gain: float = 80.0
    para_hr_gain: float = 50.0
    sym_svr_gain: float = 8.0
    para_svr_gain: float = 3.0
    fatigue_sv_penalty: float = 25.0
    pain_sym_gain: float = 0.35
    fear_sym_gain: float = 0.45
    motor_sym_gain: float = 0.55
    motor_sv_gain: float = 35.0
    volume_svr_sensitivity: float = 12.0  # 脫水→SVR↑


class VirtualCardiovascularEngine:
    def __init__(self, params: CardioParams | None = None, seed: int = 0) -> None:
        self.params = params or CardioParams()
        self.seed = seed
        self.state = CardioState(
            hr_bpm=self.params.hr_rest,
            sv_ml=self.params.sv_rest_ml,
            svr=self.params.svr_rest,
            cvp_mmhg=self.params.cvp_rest,
            blood_volume_l=self.params.blood_volume_rest_l,
        )
        self._update_derived()

    def _update_derived(self) -> None:
        s = self.state
        s.co_l_min = co_l_per_min(s.hr_bpm, s.sv_ml)
        s.map_mmhg = map_mmhg(s.co_l_min, s.svr, s.cvp_mmhg)
        # 脈壓近似：隨收縮力與 SV
        pulse = 40.0 * s.contractility * (s.sv_ml / self.params.sv_rest_ml)
        s.sbp_mmhg = s.map_mmhg + 0.6 * pulse
        s.dbp_mmhg = s.map_mmhg - 0.4 * pulse

    def step(
        self,
        dt: float,
        autonomic: AutonomicTone,
        drive: NeuralDrive,
        hydration: float = 1.0,
        fatigue: float = 0.1,
        blood_volume_l: float | None = None,
    ) -> CardioState:
        """以自主神經 + 運動／恐懼／疼痛／疲勞驅動，非標籤寫死 HR。"""
        p = self.params
        s = self.state
        if blood_volume_l is not None:
            s.blood_volume_l = max(2.0, blood_volume_l)

        # 目標自主張力（連續混合）
        sym = clamp01(
            autonomic.sympathetic
            + p.motor_sym_gain * drive.motor_intensity
            + p.fear_sym_gain * drive.fear_autonomic
            + p.pain_sym_gain * drive.pain_intensity
            + 0.2 * drive.protect_arousal
            - 0.25 * drive.attachment_calm
        )
        para = clamp01(
            autonomic.parasympathetic
            - 0.5 * drive.motor_intensity
            - 0.4 * drive.fear_autonomic
            - 0.3 * drive.pain_intensity
            + 0.3 * drive.attachment_calm
        )

        # 目標 HR／SV／SVR
        hr_target = p.hr_rest + p.sym_hr_gain * (sym - 0.25) - p.para_hr_gain * (para - 0.55)
        hr_target = clamp(hr_target, p.hr_min, p.hr_max)

        vol_factor = s.blood_volume_l / p.blood_volume_rest_l
        sv_target = (
            p.sv_rest_ml
            + p.motor_sv_gain * drive.motor_intensity
            - p.fatigue_sv_penalty * fatigue
            + 15.0 * (vol_factor - 1.0)
            + 10.0 * (sym - 0.25)  # 收縮力
        )
        sv_target = clamp(sv_target, p.sv_min_ml, p.sv_max_ml)

        # 脫水／失血 → SVR 代償上升；運動 → 肌肉血管擴張（SVR↓）
        dehyd = clamp(1.0 - hydration, 0.0, 1.0)
        svr_target = (
            p.svr_rest
            + p.sym_svr_gain * (sym - 0.25)
            - p.para_svr_gain * (para - 0.55)
            + p.volume_svr_sensitivity * dehyd
            - 6.0 * drive.motor_intensity
            + 4.0 * drive.pain_intensity
        )
        svr_target = clamp(svr_target, 8.0, 40.0)

        cvp_target = p.cvp_rest * vol_factor
        contractility = clamp(1.0 + 0.4 * (sym - 0.25) - 0.3 * fatigue, 0.4, 1.8)

        # 一階追隨（避免一步跳變）
        tau = max(dt, 1e-3)
        alpha = 1.0 - pow(0.5, dt / 2.0)  # ~2s 半衰期風格
        s.hr_bpm += (hr_target - s.hr_bpm) * alpha
        s.sv_ml += (sv_target - s.sv_ml) * alpha
        s.svr += (svr_target - s.svr) * alpha
        s.cvp_mmhg += (cvp_target - s.cvp_mmhg) * alpha
        s.contractility += (contractility - s.contractility) * alpha

        # 收縮／舒張相位
        s.phase = (s.phase + (s.hr_bpm / 60.0) * dt) % 1.0

        self._update_derived()
        # 回寫自主（供其他系統）
        autonomic.sympathetic = sym
        autonomic.parasympathetic = para
        return s
