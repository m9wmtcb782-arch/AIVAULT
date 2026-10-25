"""神經雙向橋接：決策→生理→狀態→感覺→決策。

接入：痛覺 DangerMemory、恐懼求生、浪漫依附、母愛、自主神經、
動作意圖、疲勞、長期記憶、自主決策。

軟依賴 sibling research 模組；缺失時使用 stub，不破壞正式頁。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .state import BehaviorStrategy, NeuralDrive, TwinSnapshot
from .units import clamp01


@dataclass
class DecisionContext:
    intent_action: str = "idle"  # idle|walk|run|flee|protect|rest
    motor_intensity: float = 0.0
    fear_level: float = 0.0
    pain_level: float = 0.0
    protect_motivation: float = 0.0
    attachment_secure: float = 0.0
    danger_memory_threat: float = 0.0
    labels: Dict[str, float] = field(default_factory=dict)


@dataclass
class LongTermPhysioMemory:
    """長期生理／行為記憶（簡化可序列化）。"""
    events: List[Dict[str, Any]] = field(default_factory=list)

    def record(self, kind: str, payload: dict) -> None:
        self.events.append({"kind": kind, **payload})
        if len(self.events) > 200:
            self.events = self.events[-200:]

    def mean_threat(self, object_id: str) -> float:
        vals = [e.get("threat", 0.0) for e in self.events if e.get("object_id") == object_id]
        return sum(vals) / len(vals) if vals else 0.0


class PhysiologyNeuralBridge:
    def __init__(self) -> None:
        self.memory = LongTermPhysioMemory()
        self._nociception = None
        self._conflict = None
        self._try_import_siblings()

    def _try_import_siblings(self) -> None:
        try:
            from dark_star_nociception.nociception_core import NociceptionCore
            self._nociception = NociceptionCore()
        except Exception:
            self._nociception = None
        try:
            from dark_star_love_fear_survival.emotional_conflict_engine import EmotionalConflictEngine
            self._conflict = EmotionalConflictEngine(nociception_core=self._nociception)
        except Exception:
            self._conflict = None

    def drive_from_decision(self, ctx: DecisionContext) -> NeuralDrive:
        """神經決策 → 生理驅動（禁止把情緒字串寫成固定 HR）。"""
        motor = ctx.motor_intensity
        if ctx.intent_action == "run":
            motor = max(motor, 0.85)
        elif ctx.intent_action == "walk":
            motor = max(motor, 0.35)
        elif ctx.intent_action == "flee":
            motor = max(motor, 0.7)
        elif ctx.intent_action == "rest":
            motor = min(motor, 0.05)
        elif ctx.intent_action == "idle":
            motor = min(motor, 0.1)

        return NeuralDrive(
            motor_intensity=clamp01(motor),
            fear_autonomic=clamp01(ctx.fear_level + 0.5 * ctx.danger_memory_threat),
            pain_intensity=clamp01(ctx.pain_level),
            protect_arousal=clamp01(ctx.protect_motivation),
            attachment_calm=clamp01(ctx.attachment_secure),
            decision_effort=clamp01(0.3 * motor + 0.4 * ctx.fear_level + 0.3 * ctx.protect_motivation),
            injury_load=clamp01(ctx.labels.get("injury", 0.0)),
        )

    def strategy_from_physiology(self, snap: TwinSnapshot, ctx: DecisionContext) -> BehaviorStrategy:
        """生理狀態 → 行為策略（端到端可驗證，非儀表裝飾）。"""
        fatigue = snap.metabolism.fatigue
        spo2 = snap.respiratory.spo2
        glucose = snap.metabolism.glucose_mg_dl
        hydration = snap.homeostasis.hydration
        rationale: List[str] = []

        pace = 1.0
        rest = 0.0
        avoid = 0.0
        latency = 1.0

        if fatigue > 0.55:
            pace *= 1.0 - 0.5 * (fatigue - 0.55) / 0.45
            rest = max(rest, fatigue)
            rationale.append("fatigue_slowdown")
        if glucose < 70:
            pace *= 0.6
            rest = max(rest, 0.7)
            rationale.append("hypoglycemia_conserve")
        if hydration < 0.75:
            pace *= 0.75
            rationale.append("dehydration_limit")
        if spo2 < 0.90:
            pace *= 0.5
            rest = max(rest, 0.8)
            rationale.append("hypoxemia_rest")
        if snap.cardio.hr_bpm > 160 and ctx.intent_action in ("run", "flee"):
            pace *= 0.7
            rationale.append("tachycardia_pace_cut")
        if ctx.pain_level > 0.6 or snap.neural_drive.injury_load > 0.5:
            avoid = max(avoid, 0.6)
            pace *= 0.65
            rationale.append("pain_protect")
        if ctx.fear_level > 0.5:
            avoid = max(avoid, 0.4)
            latency = 1.0 + 0.4 * ctx.fear_level
            rationale.append("fear_latency")

        pace = clamp01(pace)
        # 選擇動作
        if rest > 0.75 or spo2 < 0.88:
            chosen = "rest"
        elif ctx.intent_action == "flee" and pace > 0.4:
            chosen = "flee"
        elif ctx.intent_action == "protect" and fatigue < 0.85:
            chosen = "protect"
        elif ctx.intent_action in ("run", "walk") and pace < 0.45:
            chosen = "walk_slow" if pace > 0.2 else "rest"
        else:
            chosen = ctx.intent_action if ctx.intent_action != "idle" else ("continue" if pace > 0.5 else "rest")

        return BehaviorStrategy(
            pace_scale=max(0.05, pace),
            rest_preference=clamp01(rest),
            risk_avoidance=clamp01(avoid),
            action_latency_scale=latency,
            chosen_action=chosen,
            rationale=rationale,
        )

    def apply_injury_stimulus(self, site: str, intensity: float, object_id: Optional[str] = None) -> float:
        """可選接入痛覺核心；回傳痛覺強度。"""
        if self._nociception is None:
            threat = intensity
            self.memory.record("pain_stub", {"site": site, "threat": threat, "object_id": object_id})
            return threat
        ev = self._nociception.sense(site, "impact", intensity, object_id=object_id, tissue="cutaneous")
        threat = float(getattr(ev, "threat", intensity))
        self.memory.record("pain", {"site": site, "threat": threat, "object_id": object_id, "nrs": getattr(ev, "nrs", 0)})
        return clamp01(threat)

    def sibling_status(self) -> dict:
        return {
            "nociception_linked": self._nociception is not None,
            "conflict_linked": self._conflict is not None,
        }
