"""傷害感受器引擎：皮膚／肌肉／骨關節／內臟／神經病理／發炎慢性。

各類痛覺具不同刺激條件、訊號特徵與時間曲線，禁止單一數值通用。
證據分級：approximation（簡化現象學模型，非臨床校準）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class TissueClass(str, Enum):
    CUTANEOUS = "cutaneous"          # 皮膚
    MUSCLE = "muscle"                # 肌肉／深層組織
    BONE_JOINT = "bone_joint"        # 骨骼與關節
    VISCERAL = "visceral"            # 內臟
    NEUROPATHIC = "neuropathic"      # 神經病理性
    INFLAMMATORY = "inflammatory"    # 發炎／慢性


class StimulusKind(str, Enum):
    HEAT = "heat"
    COLD = "cold"
    PRESSURE = "pressure"
    CHEMICAL = "chemical"
    PUNCTURE = "puncture"      # 針刺
    CUT = "cut"                # 切割
    STRETCH = "stretch"        # 拉傷／牽拉
    IMPACT = "impact"          # 撞擊
    ISCHEMIA = "ischemia"      # 缺血
    INFLAMMATION = "inflammation"
    DISTENSION = "distension"  # 器官擴張
    ABNORMAL_LOAD = "abnormal_load"  # 異常受力
    ECTOPIC = "ectopic"        # 異常神經放電


@dataclass(frozen=True)
class FiberProfile:
    """不同組織的 Aδ／C 通道時間與強度特徵。"""
    a_delta_onset_ms: float
    a_delta_peak_ms: float
    a_delta_decay_tau_ms: float
    c_onset_ms: float
    c_peak_ms: float
    c_decay_tau_ms: float
    a_delta_gain: float
    c_gain: float
    spatial_spread: float  # 空間擴散傾向（內臟較高）
    affective_weight: float  # 情緒成分權重


# 各組織預設纖維剖面（簡化近似，非臨床常數）
TISSUE_PROFILES: Dict[TissueClass, FiberProfile] = {
    TissueClass.CUTANEOUS: FiberProfile(
        a_delta_onset_ms=20, a_delta_peak_ms=80, a_delta_decay_tau_ms=120,
        c_onset_ms=200, c_peak_ms=600, c_decay_tau_ms=900,
        a_delta_gain=1.0, c_gain=0.85, spatial_spread=0.15, affective_weight=0.35,
    ),
    TissueClass.MUSCLE: FiberProfile(
        a_delta_onset_ms=40, a_delta_peak_ms=150, a_delta_decay_tau_ms=250,
        c_onset_ms=300, c_peak_ms=900, c_decay_tau_ms=1400,
        a_delta_gain=0.7, c_gain=1.1, spatial_spread=0.35, affective_weight=0.45,
    ),
    TissueClass.BONE_JOINT: FiberProfile(
        a_delta_onset_ms=30, a_delta_peak_ms=100, a_delta_decay_tau_ms=200,
        c_onset_ms=250, c_peak_ms=800, c_decay_tau_ms=1600,
        a_delta_gain=0.85, c_gain=1.0, spatial_spread=0.25, affective_weight=0.5,
    ),
    TissueClass.VISCERAL: FiberProfile(
        a_delta_onset_ms=80, a_delta_peak_ms=300, a_delta_decay_tau_ms=400,
        c_onset_ms=400, c_peak_ms=1400, c_decay_tau_ms=2200,
        a_delta_gain=0.35, c_gain=1.35, spatial_spread=0.75, affective_weight=0.7,
    ),
    TissueClass.NEUROPATHIC: FiberProfile(
        a_delta_onset_ms=10, a_delta_peak_ms=50, a_delta_decay_tau_ms=80,
        c_onset_ms=100, c_peak_ms=400, c_decay_tau_ms=3000,
        a_delta_gain=1.2, c_gain=1.4, spatial_spread=0.5, affective_weight=0.8,
    ),
    TissueClass.INFLAMMATORY: FiberProfile(
        a_delta_onset_ms=50, a_delta_peak_ms=200, a_delta_decay_tau_ms=500,
        c_onset_ms=350, c_peak_ms=1200, c_decay_tau_ms=2800,
        a_delta_gain=0.9, c_gain=1.25, spatial_spread=0.4, affective_weight=0.55,
    ),
}


# 各組織允許的刺激種類
TISSUE_STIMULI: Dict[TissueClass, frozenset] = {
    TissueClass.CUTANEOUS: frozenset({
        StimulusKind.HEAT, StimulusKind.COLD, StimulusKind.PRESSURE,
        StimulusKind.CHEMICAL, StimulusKind.PUNCTURE, StimulusKind.CUT,
    }),
    TissueClass.MUSCLE: frozenset({
        StimulusKind.STRETCH, StimulusKind.IMPACT, StimulusKind.PRESSURE,
        StimulusKind.ISCHEMIA, StimulusKind.CHEMICAL,
    }),
    TissueClass.BONE_JOINT: frozenset({
        StimulusKind.IMPACT, StimulusKind.ABNORMAL_LOAD, StimulusKind.STRETCH,
        StimulusKind.PRESSURE,
    }),
    TissueClass.VISCERAL: frozenset({
        StimulusKind.DISTENSION, StimulusKind.ISCHEMIA, StimulusKind.INFLAMMATION,
        StimulusKind.STRETCH, StimulusKind.CHEMICAL,
    }),
    TissueClass.NEUROPATHIC: frozenset({
        StimulusKind.ECTOPIC, StimulusKind.PRESSURE, StimulusKind.CHEMICAL,
        StimulusKind.HEAT, StimulusKind.COLD,
    }),
    TissueClass.INFLAMMATORY: frozenset({
        StimulusKind.INFLAMMATION, StimulusKind.PRESSURE, StimulusKind.HEAT,
        StimulusKind.CHEMICAL, StimulusKind.STRETCH,
    }),
}


@dataclass
class NociceptorState:
    tissue: TissueClass
    site: str
    baseline_threshold: float = 0.25
    sensitization: float = 0.0   # 周邊敏化 [0, 1]
    adaptation: float = 0.0      # 適應／習慣化 [0, 1]
    inflammation: float = 0.0
    nerve_damage: float = 0.0    # 神經病理性損傷標記


@dataclass
class ReceptorFiring:
    tissue: TissueClass
    site: str
    stimulus: StimulusKind
    intensity: float
    effective: float
    a_delta_drive: float
    c_fiber_drive: float
    profile: FiberProfile
    time_curve_ad: List[tuple]  # (t_ms, amplitude)
    time_curve_c: List[tuple]
    evidence_tier: str = "approximation"


def _exp_curve(onset: float, peak: float, tau: float, gain: float,
               intensity: float, n: int = 24) -> List[tuple]:
    """簡化雙相時間曲線：延遲上升 → 指數衰減。"""
    import math
    pts = []
    t_end = peak + tau * 3
    for i in range(n):
        t = (t_end / max(n - 1, 1)) * i
        if t < onset:
            amp = 0.0
        elif t <= peak:
            amp = intensity * gain * ((t - onset) / max(peak - onset, 1e-6))
        else:
            amp = intensity * gain * math.exp(-(t - peak) / max(tau, 1e-6))
        pts.append((round(t, 2), round(max(0.0, min(1.5, amp)), 4)))
    return pts


class NociceptorEngine:
    """依組織類別產生具差異的傷害感受器放電。"""

    def __init__(self) -> None:
        self._sites: Dict[str, NociceptorState] = {}

    def ensure_site(self, site: str, tissue: TissueClass) -> NociceptorState:
        if site not in self._sites:
            self._sites[site] = NociceptorState(tissue=tissue, site=site)
        return self._sites[site]

    def get_state(self, site: str) -> Optional[NociceptorState]:
        return self._sites.get(site)

    def set_sensitization(self, site: str, value: float) -> None:
        st = self._sites.get(site)
        if st:
            st.sensitization = max(0.0, min(1.0, value))

    def set_inflammation(self, site: str, value: float) -> None:
        st = self._sites.get(site)
        if st:
            st.inflammation = max(0.0, min(1.0, value))

    def set_nerve_damage(self, site: str, value: float) -> None:
        st = self._sites.get(site)
        if st:
            st.nerve_damage = max(0.0, min(1.0, value))

    def fire(
        self,
        site: str,
        tissue: TissueClass,
        stimulus: StimulusKind,
        intensity: float,
    ) -> ReceptorFiring:
        if not (0.0 <= intensity <= 1.0):
            raise ValueError("intensity must be within [0, 1]")
        allowed = TISSUE_STIMULI[tissue]
        if stimulus not in allowed:
            # 允許跨類標記但降低增益（研究用），不靜默等同
            cross_penalty = 0.45
        else:
            cross_penalty = 1.0

        st = self.ensure_site(site, tissue)
        profile = TISSUE_PROFILES[tissue]

        # 有效強度：閾值、敏化、適應、發炎、神經損傷
        thresh = st.baseline_threshold * (1.0 - 0.4 * st.sensitization)
        raw = max(0.0, intensity - thresh) / max(1.0 - thresh, 1e-6)
        sens_boost = 1.0 + st.sensitization * 0.9 + st.inflammation * 0.5
        adapt_factor = 1.0 - 0.5 * st.adaptation
        neuro_boost = 1.0 + st.nerve_damage * 0.7 if tissue == TissueClass.NEUROPATHIC else 1.0
        effective = min(1.0, raw * sens_boost * adapt_factor * neuro_boost * cross_penalty)

        a_drive = min(1.0, effective * profile.a_delta_gain)
        c_drive = min(1.0, effective * profile.c_gain)

        # 適應：重複刺激緩慢上升
        st.adaptation = min(0.9, st.adaptation + effective * 0.05)
        # 敏化：高強度後累積（由 injury 引擎也可寫入）
        if effective > 0.7:
            st.sensitization = min(0.95, st.sensitization + (effective - 0.7) * 0.25)

        return ReceptorFiring(
            tissue=tissue,
            site=site,
            stimulus=stimulus,
            intensity=intensity,
            effective=effective,
            a_delta_drive=a_drive,
            c_fiber_drive=c_drive,
            profile=profile,
            time_curve_ad=_exp_curve(
                profile.a_delta_onset_ms, profile.a_delta_peak_ms,
                profile.a_delta_decay_tau_ms, profile.a_delta_gain, effective,
            ),
            time_curve_c=_exp_curve(
                profile.c_onset_ms, profile.c_peak_ms,
                profile.c_decay_tau_ms, profile.c_gain, effective,
            ),
        )

    def peak_times(self, firing: ReceptorFiring) -> Dict[str, float]:
        return {
            "a_delta_peak_ms": firing.profile.a_delta_peak_ms,
            "c_peak_ms": firing.profile.c_peak_ms,
            "spatial_spread": firing.profile.spatial_spread,
            "affective_weight": firing.profile.affective_weight,
        }
