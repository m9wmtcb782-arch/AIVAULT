"""浪漫依附記憶：人物經歷、信任、對話、情緒史、分離重逢修復。

禁用虛構痛苦孤獨強迫陪伴。隱私可刪。
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import time


@dataclass
class EmotionBeat:
    t: float
    label: str
    valence: float
    arousal: float


@dataclass
class PartnerMemory:
    partner_id: str
    trust: float = 0.0
    shared_events: List[str] = field(default_factory=list)
    dialogue_summary_hashes: List[str] = field(default_factory=list)
    emotion_history: List[EmotionBeat] = field(default_factory=list)
    separations: int = 0
    reunions: int = 0
    repair_success: float = 0.0
    consent_store: bool = False          # 須授權才持久
    loneliness_manipulation_forbidden: bool = True


class AttachmentMemoryEngine:
    def __init__(self) -> None:
        self.partners: Dict[str, PartnerMemory] = {}

    def get(self, partner_id: str) -> PartnerMemory:
        if partner_id not in self.partners:
            self.partners[partner_id] = PartnerMemory(partner_id=partner_id)
        return self.partners[partner_id]

    def record_event(self, partner_id: str, event: str, trust_delta: float = 0.0) -> PartnerMemory:
        # 禁止寫入強迫陪伴／虛構痛苦操控類事件標籤
        banned = ("force_companionship", "fake_loneliness_trap", "guilt_trap")
        if any(b in event for b in banned):
            raise ValueError("forbidden manipulative memory event")
        p = self.get(partner_id)
        p.shared_events.append(event)
        p.trust = max(0.0, min(1.0, p.trust + trust_delta))
        return p

    def record_emotion(self, partner_id: str, label: str, valence: float, arousal: float) -> None:
        p = self.get(partner_id)
        p.emotion_history.append(EmotionBeat(time.time(), label, valence, arousal))

    def separate(self, partner_id: str) -> None:
        self.get(partner_id).separations += 1

    def reunite(self, partner_id: str, repair: float) -> PartnerMemory:
        p = self.get(partner_id)
        p.reunions += 1
        p.repair_success = min(1.0, 0.6 * p.repair_success + 0.4 * repair)
        p.trust = min(1.0, p.trust + 0.05 * repair)
        return p

    def authorize_persist(self, partner_id: str, consent: bool) -> None:
        self.get(partner_id).consent_store = consent

    def export_authorized(self) -> Dict[str, dict]:
        out = {}
        for k, p in self.partners.items():
            if p.consent_store:
                out[k] = asdict(p)
        return out

    def restore_authorized(self, data: Dict[str, dict]) -> None:
        for k, d in data.items():
            beats = [EmotionBeat(**b) for b in d.get("emotion_history", [])]
            d = dict(d)
            d["emotion_history"] = beats
            self.partners[k] = PartnerMemory(**d)

    def delete_partner_privacy(self, partner_id: str) -> bool:
        """可刪隱私控制。"""
        if partner_id in self.partners:
            del self.partners[partner_id]
            return True
        return False
