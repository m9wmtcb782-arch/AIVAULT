"""組織損傷與恢復引擎。

損傷程度與疼痛等級、反射、意識分別追蹤。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class TissueInjury:
    site: str
    tissue: str
    severity: float = 0.0       # [0,1]
    inflammation: float = 0.0
    mobility_limit: float = 0.0  # 活動限制
    healing_progress: float = 0.0
    history: List[dict] = field(default_factory=list)


class InjuryRecoveryEngine:
    def __init__(self, heal_rate: float = 0.08) -> None:
        self.heal_rate = heal_rate
        self.sites: Dict[str, TissueInjury] = {}

    def apply_damage(self, site: str, tissue: str, effective: float) -> TissueInjury:
        inj = self.sites.setdefault(site, TissueInjury(site=site, tissue=tissue))
        if effective > 0.70:
            delta = (effective - 0.70) * 0.2
            inj.severity = min(1.0, inj.severity + delta)
            inj.inflammation = min(1.0, inj.inflammation + delta * 1.2)
            inj.mobility_limit = min(1.0, inj.severity * 0.9)
            inj.history.append({"delta": delta, "effective": effective})
        return inj

    def recover(self, fraction: float | None = None) -> None:
        f = self.heal_rate if fraction is None else fraction
        if not (0.0 <= f <= 1.0):
            raise ValueError("fraction must be within [0, 1]")
        for inj in self.sites.values():
            inj.severity *= (1 - f)
            inj.inflammation *= (1 - f)
            inj.mobility_limit = inj.severity * 0.9
            inj.healing_progress = min(1.0, inj.healing_progress + f * (1.0 - inj.severity))

    def get(self, site: str) -> TissueInjury | None:
        return self.sites.get(site)

    def mobility_factor(self, site: str) -> float:
        """1.0 = 無限制；降低表示傷後保護。"""
        inj = self.sites.get(site)
        if not inj:
            return 1.0
        return max(0.1, 1.0 - inj.mobility_limit)
