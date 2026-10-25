"""危險記憶引擎：完整事件欄位＋預測避開。

接入長期記憶／世界模型／自主學習的虛擬介面。
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple
import time


@dataclass
class DangerEvent:
    stimulus_source: str
    stimulus_type: str
    body_site: str
    intensity: float
    duration_s: float
    body_state: dict
    reflex_result: dict
    tissue_injury: float
    recovery_snapshot: dict
    environment_features: dict
    agent_action: str
    avoided_later: Optional[bool] = None
    timestamp: float = field(default_factory=time.time)
    embodiment_id: str = "virtual-default"

    def key(self) -> Tuple[str, str]:
        return (self.body_site, self.stimulus_type)


class DangerMemoryEngine:
    def __init__(self, avoid_threshold: float = 0.45) -> None:
        self.avoid_threshold = avoid_threshold
        self.events: List[DangerEvent] = []
        # (site, stimulus) -> threat score
        self.threat_index: Dict[Tuple[str, str], float] = {}
        # object/feature level prediction
        self.object_threat: Dict[str, float] = {}

    def record(self, event: DangerEvent) -> None:
        self.events.append(event)
        key = event.key()
        old = self.threat_index.get(key, 0.0)
        threat = max(
            old * 0.98,
            0.55 * event.intensity + 0.3 * event.tissue_injury
            + (0.2 if event.reflex_result.get("withdrawal") else 0.0),
        )
        self.threat_index[key] = min(1.0, threat)
        obj = event.environment_features.get("object_id") or event.stimulus_source
        if obj:
            prev = self.object_threat.get(obj, 0.0)
            self.object_threat[obj] = min(1.0, max(prev * 0.95, threat))

    def predict_risk(self, site: str, stimulus_type: str) -> float:
        return self.threat_index.get((site, stimulus_type), 0.0)

    def predict_object_risk(self, object_id: str) -> float:
        return self.object_threat.get(object_id, 0.0)

    def should_avoid_before_contact(
        self,
        site: str,
        stimulus_type: str,
        object_id: Optional[str] = None,
    ) -> dict:
        """接觸前預測：可避開或採取保護。"""
        site_risk = self.predict_risk(site, stimulus_type)
        obj_risk = self.predict_object_risk(object_id) if object_id else 0.0
        risk = max(site_risk, obj_risk)
        avoid = risk >= self.avoid_threshold
        protect = risk >= self.avoid_threshold * 0.7
        action = "avoid" if avoid else ("protect" if protect else "proceed_cautious")
        return {
            "risk": risk,
            "avoid": avoid,
            "protect": protect,
            "action": action,
            "before_contact": True,
        }

    def mark_avoidance_success(self, object_id: str, success: bool) -> None:
        for ev in reversed(self.events):
            oid = ev.environment_features.get("object_id") or ev.stimulus_source
            if oid == object_id and ev.avoided_later is None:
                ev.avoided_later = success
                break

    def export_for_long_term_memory(self) -> List[dict]:
        return [asdict(e) for e in self.events]

    def retain_across_embodiment(self) -> Dict[str, float]:
        """換身時保留物件級危險記憶。"""
        return dict(self.object_threat)

    def import_retained(self, object_threat: Dict[str, float]) -> None:
        for k, v in object_threat.items():
            self.object_threat[k] = max(self.object_threat.get(k, 0.0), v)
