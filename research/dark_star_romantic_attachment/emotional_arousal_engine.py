"""情緒喚起：心跳呼吸、微表情、害羞臉紅、眼神、頭肩、語速音量、姿態距離。

輸出連續參數鉤子，非固定動畫。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ArousalOutput:
    heart_rate_scale: float = 1.0
    breath_rate_scale: float = 1.0
    micro_expression_softness: float = 0.0
    blush: float = 0.0
    gaze_hold: float = 0.0
    gaze_avert: float = 0.0
    head_tilt: float = 0.0
    shoulder_openness: float = 0.5
    speech_rate_scale: float = 1.0
    speech_volume_scale: float = 1.0
    pitch_variance: float = 0.0
    interpersonal_distance_pref: float = 0.5  # 大＝較遠
    tension: float = 0.0
    anticipation: float = 0.0
    relaxation: float = 0.5
    animation_forbidden: bool = True
    evidence_tier: str = "approximation"


class EmotionalArousalEngine:
    def compute(
        self,
        autonomic: float,
        affection: float,
        uncertainty: float,
        rejection: float = 0.0,
        shy: float = 0.0,
    ) -> ArousalOutput:
        hr = 1.0 + 0.45 * autonomic + 0.15 * affection
        br = 1.0 + 0.35 * autonomic
        blush = min(1.0, 0.5 * shy + 0.35 * autonomic * affection)
        gaze_hold = max(0.0, 0.55 * affection + 0.2 * autonomic - 0.4 * rejection - 0.2 * shy)
        gaze_avert = min(1.0, 0.5 * shy + 0.4 * uncertainty + 0.5 * rejection)
        tension = min(1.0, uncertainty * 0.5 + autonomic * 0.3 + rejection * 0.4)
        anticipation = min(1.0, affection * 0.4 + autonomic * 0.4 * (1.0 - rejection))
        relax = max(0.0, 0.6 - tension + 0.2 * affection * (1.0 - uncertainty))
        dist = max(0.15, min(0.95, 0.55 - 0.25 * affection + 0.3 * rejection + 0.15 * shy))
        return ArousalOutput(
            heart_rate_scale=hr,
            breath_rate_scale=br,
            micro_expression_softness=min(1.0, affection * 0.6),
            blush=blush,
            gaze_hold=gaze_hold,
            gaze_avert=gaze_avert,
            head_tilt=min(0.4, affection * 0.25 + shy * 0.15),
            shoulder_openness=max(0.1, 0.5 + 0.3 * affection - 0.4 * rejection),
            speech_rate_scale=max(0.7, 1.0 - shy * 0.2 + autonomic * 0.1),
            speech_volume_scale=max(0.6, 1.0 - shy * 0.25),
            pitch_variance=min(1.0, autonomic * 0.5 + shy * 0.2),
            interpersonal_distance_pref=dist,
            tension=tension,
            anticipation=anticipation,
            relaxation=relax,
            animation_forbidden=True,
        )
