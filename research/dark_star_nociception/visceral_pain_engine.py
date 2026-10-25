"""內臟痛引擎：擴張、缺血、發炎、牽拉。

特徵：Aδ 弱、C 強、空間定位差、情緒權重高、起峰較慢。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict

from .nociceptor_engine import StimulusKind, TissueClass


class VisceralSource(str, Enum):
    DISTENSION = "distension"
    ISCHEMIA = "ischemia"
    INFLAMMATION = "inflammation"
    TRACTION = "traction"


@dataclass
class VisceralEvent:
    organ: str
    source: VisceralSource
    intensity: float
    referred_site: str
    a_delta: float
    c_fiber: float
    localization_blur: float
    affective: float
    peak_latency_ms: float
    evidence_tier: str = "approximation"


class VisceralPainEngine:
    """獨立內臟通路（可併入 NociceptorEngine.VISCERAL）。"""

    ORGAN_REFERRED = {
        "uterus": "lower_abdomen",
        "stomach": "epigastrium",
        "intestine": "periumbilical",
        "bladder": "suprapubic",
        "heart": "left_chest_arm",
    }

    def stimulate(
        self,
        organ: str,
        source: VisceralSource,
        intensity: float,
    ) -> VisceralEvent:
        if not (0.0 <= intensity <= 1.0):
            raise ValueError("intensity must be within [0, 1]")
        # 內臟：C 主導
        gains = {
            VisceralSource.DISTENSION: (0.2, 1.1, 1200),
            VisceralSource.ISCHEMIA: (0.25, 1.25, 1600),
            VisceralSource.INFLAMMATION: (0.3, 1.15, 1400),
            VisceralSource.TRACTION: (0.35, 1.0, 1000),
        }
        ad_g, c_g, peak = gains[source]
        a_delta = min(1.0, intensity * ad_g)
        c_fiber = min(1.0, intensity * c_g)
        blur = 0.55 + 0.35 * intensity
        affective = min(1.0, 0.5 * a_delta + 0.85 * c_fiber)
        referred = self.ORGAN_REFERRED.get(organ, "abdomen")
        return VisceralEvent(
            organ=organ,
            source=source,
            intensity=intensity,
            referred_site=referred,
            a_delta=a_delta,
            c_fiber=c_fiber,
            localization_blur=blur,
            affective=affective,
            peak_latency_ms=float(peak),
        )

    def as_tissue(self) -> TissueClass:
        return TissueClass.VISCERAL

    def stimulus_map(self, source: VisceralSource) -> StimulusKind:
        return {
            VisceralSource.DISTENSION: StimulusKind.DISTENSION,
            VisceralSource.ISCHEMIA: StimulusKind.ISCHEMIA,
            VisceralSource.INFLAMMATION: StimulusKind.INFLAMMATION,
            VisceralSource.TRACTION: StimulusKind.STRETCH,
        }[source]
