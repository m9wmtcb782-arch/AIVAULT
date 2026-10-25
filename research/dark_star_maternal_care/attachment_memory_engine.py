"""依附／照顧記憶：身分、照顧史、有效安撫、喜好需求、成長、危險保護。

不依賴血緣預設。
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import time


@dataclass
class CareEpisode:
    timestamp: float
    cue: str
    action: str
    success: float
    notes: str = ""


@dataclass
class AttachteeProfile:
    identity_id: str
    display_name: str = ""
    kinship_assumed: bool = False  # 永不因血緣自動 True
    bond_strength: float = 0.0
    trust: float = 0.0
    soothing_methods: Dict[str, float] = field(default_factory=dict)  # method -> efficacy
    preferences: Dict[str, float] = field(default_factory=dict)
    needs_history: List[str] = field(default_factory=list)
    growth_stage: str = "infant"
    danger_protections: List[dict] = field(default_factory=list)
    care_log: List[CareEpisode] = field(default_factory=list)
    interaction_count: int = 0


class AttachmentMemoryEngine:
    def __init__(self) -> None:
        self.profiles: Dict[str, AttachteeProfile] = {}
        self._session_active = True

    def get_or_create(self, identity_id: str, name: str = "") -> AttachteeProfile:
        if identity_id not in self.profiles:
            self.profiles[identity_id] = AttachteeProfile(
                identity_id=identity_id, display_name=name, kinship_assumed=False,
            )
        return self.profiles[identity_id]

    def record_care(
        self, identity_id: str, cue: str, action: str, success: float, notes: str = "",
    ) -> AttachteeProfile:
        p = self.get_or_create(identity_id)
        p.care_log.append(CareEpisode(time.time(), cue, action, success, notes))
        p.interaction_count += 1
        p.bond_strength = min(1.0, p.bond_strength + 0.04 * success + 0.01)
        p.trust = min(1.0, p.trust + 0.03 * success)
        p.soothing_methods[action] = min(
            1.0, p.soothing_methods.get(action, 0.3) * 0.85 + success * 0.4,
        )
        p.needs_history.append(cue)
        return p

    def best_soothing(self, identity_id: str) -> Optional[str]:
        p = self.profiles.get(identity_id)
        if not p or not p.soothing_methods:
            return None
        return max(p.soothing_methods.items(), key=lambda x: x[1])[0]

    def record_protection(self, identity_id: str, hazard: str, outcome: str) -> None:
        p = self.get_or_create(identity_id)
        p.danger_protections.append({
            "hazard": hazard, "outcome": outcome, "t": time.time(),
        })
        p.bond_strength = min(1.0, p.bond_strength + 0.05)

    def set_growth(self, identity_id: str, stage: str) -> None:
        p = self.get_or_create(identity_id)
        p.growth_stage = stage

    def persist_across_dialogue_end(self) -> Dict[str, dict]:
        """對話結束不重置：匯出可持久狀態。"""
        out = {}
        for k, p in self.profiles.items():
            d = asdict(p)
            out[k] = d
        return out

    def restore(self, data: Dict[str, dict]) -> None:
        for k, d in data.items():
            log = [CareEpisode(**e) for e in d.get("care_log", [])]
            d = dict(d)
            d["care_log"] = log
            self.profiles[k] = AttachteeProfile(**d)
