"""神經訊號引擎：Aδ／C、脊髓背角、上行傳導、下行調節、敏化／適應。

證據分級：approximation。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .nociceptor_engine import FiberProfile, ReceptorFiring, TissueClass


@dataclass
class DorsalHornState:
    wind_up: float = 0.0          # 時間加總敏化
    gate_inhibitory: float = 0.3  # 閘控抑制基線
    central_sensitization: float = 0.0


@dataclass
class AscendingPacket:
    a_delta: float
    c_fiber: float
    sensory: float       # 感覺區分量
    affective: float     # 情緒／記憶區分量
    latency_ms: float
    tissue: TissueClass
    site: str
    evidence_tier: str = "approximation"


@dataclass
class NeuralPipelineResult:
    ascending: AscendingPacket
    dorsal_horn: DorsalHornState
    descending_gain: float
    modulated_a_delta: float
    modulated_c: float
    time_features: Dict[str, float]


class NeuralSignalEngine:
    """簡化脊髓—上行—下行通路。"""

    def __init__(self) -> None:
        self.dorsal: Dict[str, DorsalHornState] = {}
        self.descending_modulation: float = 0.0  # [-0.5, 0.5]；負＝促進痛，正＝抑制痛

    def set_descending(self, value: float) -> None:
        if not (-0.5 <= value <= 0.5):
            raise ValueError("descending_modulation must be within [-0.5, 0.5]")
        self.descending_modulation = value

    def _horn(self, site: str) -> DorsalHornState:
        if site not in self.dorsal:
            self.dorsal[site] = DorsalHornState()
        return self.dorsal[site]

    def process(self, firing: ReceptorFiring) -> NeuralPipelineResult:
        horn = self._horn(firing.site)
        profile: FiberProfile = firing.profile

        # 背角：wind-up 與閘控
        drive = 0.55 * firing.a_delta_drive + 0.45 * firing.c_fiber_drive
        horn.wind_up = min(1.0, horn.wind_up * 0.92 + drive * 0.18)
        if drive > 0.65:
            horn.central_sensitization = min(
                0.9, horn.central_sensitization + (drive - 0.65) * 0.12
            )

        gate = max(0.05, horn.gate_inhibitory - horn.central_sensitization * 0.3)
        spinal = drive * (1.0 + horn.wind_up * 0.35) * (1.0 - gate * 0.4)
        spinal = min(1.2, spinal)

        # 下行調節
        desc = self.descending_modulation
        mod_ad = max(0.0, min(1.0, firing.a_delta_drive * (1.0 - desc) + horn.central_sensitization * 0.1))
        mod_c = max(0.0, min(1.0, firing.c_fiber_drive * (1.0 - desc * 0.8)
                             + horn.wind_up * 0.15 + horn.central_sensitization * 0.12))

        sensory = min(1.0, 0.6 * mod_ad + 0.4 * mod_c)
        affective = min(1.0, (0.3 * mod_ad + 0.7 * mod_c) * profile.affective_weight
                        + horn.central_sensitization * 0.2)

        # 傳導延遲：Aδ 快、C 慢；內臟更慢
        latency = profile.a_delta_peak_ms * 0.4 + profile.c_peak_ms * 0.15

        ascending = AscendingPacket(
            a_delta=mod_ad,
            c_fiber=mod_c,
            sensory=sensory,
            affective=affective,
            latency_ms=latency,
            tissue=firing.tissue,
            site=firing.site,
        )
        return NeuralPipelineResult(
            ascending=ascending,
            dorsal_horn=DorsalHornState(
                wind_up=horn.wind_up,
                gate_inhibitory=horn.gate_inhibitory,
                central_sensitization=horn.central_sensitization,
            ),
            descending_gain=desc,
            modulated_a_delta=mod_ad,
            modulated_c=mod_c,
            time_features={
                "a_delta_peak_ms": profile.a_delta_peak_ms,
                "c_peak_ms": profile.c_peak_ms,
                "latency_ms": latency,
                "spatial_spread": profile.spatial_spread,
                "wind_up": horn.wind_up,
                "central_sensitization": horn.central_sensitization,
            },
        )
