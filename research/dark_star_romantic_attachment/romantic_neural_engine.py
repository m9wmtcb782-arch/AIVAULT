"""浪漫神經／內分泌近似：多巴胺／催產素／自主神經／杏仁核／前額葉／海馬／壓力疲勞。

禁止單一荷爾蒙戀愛開關。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RomanticNeuralState:
    dopamine: float = 0.0
    oxytocin: float = 0.0
    autonomic_arousal: float = 0.0
    amygdala_salience: float = 0.0
    prefrontal_appraisal: float = 0.5
    hippocampal_trace: float = 0.0
    stress: float = 0.2
    fatigue: float = 0.1
    evidence_tier: str = "approximation"


class RomanticNeuralEngine:
    def __init__(self) -> None:
        self.state = RomanticNeuralState()

    def update(
        self,
        novelty: float = 0.0,
        reciprocity: float = 0.0,
        trust: float = 0.0,
        warmth: float = 0.0,
        rejection_signal: float = 0.0,
        safety: float = 0.5,
        dt: float = 1.0,
    ) -> RomanticNeuralState:
        s = self.state
        s.amygdala_salience = min(1.0, 0.5 * novelty + 0.4 * warmth + 0.3 * rejection_signal)
        # 多巴胺：新奇＋互惠，受壓力抑制
        s.dopamine = min(1.0, s.dopamine * 0.92
                         + (0.25 * novelty + 0.3 * reciprocity + 0.15 * warmth)
                         * (1.0 - 0.35 * s.stress) * dt)
        # 催產素：信任＋溫暖累積，非開關
        s.oxytocin = min(1.0, s.oxytocin * 0.97
                         + (0.12 * trust + 0.1 * warmth + 0.08 * reciprocity)
                         * (1.0 - 0.3 * rejection_signal) * dt)
        s.autonomic_arousal = min(1.0, 0.45 * s.dopamine + 0.25 * s.amygdala_salience
                                  + 0.2 * novelty - 0.15 * s.fatigue)
        s.prefrontal_appraisal = max(0.1, min(1.0,
            0.5 + 0.25 * safety + 0.15 * trust - 0.2 * s.stress
            - 0.25 * rejection_signal + 0.1 * s.oxytocin))
        s.hippocampal_trace = min(1.0, 0.6 * trust + 0.4 * s.oxytocin)
        if rejection_signal > 0.5:
            s.dopamine *= 0.7
            s.autonomic_arousal = min(s.autonomic_arousal, 0.4)
        return s

    def attraction_drive(self) -> float:
        s = self.state
        # 多機制加權，非單一荷爾蒙
        return max(0.0, min(1.0,
            0.25 * s.dopamine + 0.2 * s.oxytocin + 0.15 * s.autonomic_arousal
            + 0.15 * s.prefrontal_appraisal + 0.15 * s.hippocampal_trace
            + 0.1 * s.amygdala_salience - 0.15 * s.fatigue - 0.1 * s.stress
        ))
