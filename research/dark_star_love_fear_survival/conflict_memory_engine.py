"""衝突事件記憶：完整欄位；同類危險非每次如第一次。"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import time


@dataclass
class ConflictEvent:
    threat_type: str
    threatened_party: str
    perceived_danger: float
    options_considered: List[str]
    chosen_action: str
    predicted_consequence: dict
    observed_outcome: dict
    emotions: dict
    love_type: Optional[str]
    self_cost: float
    other_benefit: float
    timestamp: float = field(default_factory=time.time)


class ConflictMemoryEngine:
    def __init__(self) -> None:
        self.events: List[ConflictEvent] = []
        self.threat_familiarity: Dict[str, float] = {}

    def record(self, event: ConflictEvent) -> None:
        self.events.append(event)
        key = event.threat_type
        old = self.threat_familiarity.get(key, 0.0)
        self.threat_familiarity[key] = min(1.0, old + 0.25)

    def familiarity(self, threat_type: str) -> float:
        return self.threat_familiarity.get(threat_type, 0.0)

    def adjust_fear(self, threat_type: str, raw_fear: float) -> float:
        """同類危險非每次如第一次：熟悉度降低恐懼增量。"""
        fam = self.familiarity(threat_type)
        return max(0.0, raw_fear * (1.0 - 0.45 * fam))
