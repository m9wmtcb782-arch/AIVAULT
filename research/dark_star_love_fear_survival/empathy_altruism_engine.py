"""同理與利他傾向（連續變數，非永遠犧牲）。"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EmpathyState:
    affective_empathy: float = 0.5
    cognitive_empathy: float = 0.5
    altruism_bias: float = 0.4
    stranger_compassion: float = 0.35


class EmpathyAltruismEngine:
    def __init__(self) -> None:
        self.state = EmpathyState()

    def toward(self, is_loved: bool, distress_cue: float) -> float:
        s = self.state
        base = s.stranger_compassion if not is_loved else (s.affective_empathy + s.altruism_bias) / 2
        return min(1.0, base + 0.35 * distress_cue + (0.2 if is_loved else 0.0))
