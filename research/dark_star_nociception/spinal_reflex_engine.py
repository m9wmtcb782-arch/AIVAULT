"""脊髓保護反射引擎：反射與高階 AI 決策分離。

危險時先產生保護性動作，再交由 AI 分析與更新記憶。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class ReflexType(str, Enum):
    WITHDRAWAL = "withdrawal"          # 縮手／退避
    FLEXOR = "flexor"                  # 屈肌保護
    GUARDING = "muscle_guarding"       # 肌肉防護
    FREEZE = "postural_freeze"         # 短暫姿態凍結
    NONE = "none"


@dataclass
class ReflexCommand:
    reflex: ReflexType
    site: str
    urgency: float          # [0, 1]
    latency_ms: float       # 反射潛時（短於高階決策）
    precedes_cognition: bool = True
    motor_hint: str = ""    # 給運動控制器的提示，非固定動畫名
    evidence_tier: str = "approximation"


@dataclass
class ReflexLog:
    commands: List[ReflexCommand] = field(default_factory=list)
    cognition_deferred: bool = True


class SpinalReflexEngine:
    """局部反射：僅依 Aδ／脊髓訊號，不讀危險記憶或 LLM。"""

    def __init__(
        self,
        withdrawal_threshold: float = 0.55,
        guarding_threshold: float = 0.4,
        freeze_threshold: float = 0.85,
    ) -> None:
        self.withdrawal_threshold = withdrawal_threshold
        self.guarding_threshold = guarding_threshold
        self.freeze_threshold = freeze_threshold
        self.last: Optional[ReflexCommand] = None

    def evaluate(
        self,
        site: str,
        a_delta: float,
        c_fiber: float,
        tissue_hint: str = "cutaneous",
    ) -> ReflexLog:
        cmds: List[ReflexCommand] = []
        # Aδ 主導快速縮回
        if a_delta >= self.withdrawal_threshold:
            urgency = min(1.0, (a_delta - self.withdrawal_threshold) / 0.45 + 0.5)
            cmds.append(ReflexCommand(
                reflex=ReflexType.WITHDRAWAL,
                site=site,
                urgency=urgency,
                latency_ms=25.0 + (0 if tissue_hint == "cutaneous" else 15.0),
                motor_hint="withdraw_effector_from_stimulus",
            ))
        if a_delta >= self.guarding_threshold or c_fiber >= 0.5:
            cmds.append(ReflexCommand(
                reflex=ReflexType.GUARDING,
                site=site,
                urgency=max(a_delta, c_fiber) * 0.7,
                latency_ms=40.0,
                motor_hint="increase_local_muscle_tone",
            ))
        if a_delta >= self.freeze_threshold and c_fiber >= 0.7:
            cmds.append(ReflexCommand(
                reflex=ReflexType.FREEZE,
                site=site,
                urgency=0.9,
                latency_ms=30.0,
                motor_hint="brief_postural_brace",
            ))
        if not cmds:
            cmds.append(ReflexCommand(
                reflex=ReflexType.NONE,
                site=site,
                urgency=0.0,
                latency_ms=0.0,
                precedes_cognition=True,
                motor_hint="",
            ))
        self.last = cmds[0]
        return ReflexLog(commands=cmds, cognition_deferred=True)

    def triggered_withdrawal(self, log: ReflexLog) -> bool:
        return any(c.reflex == ReflexType.WITHDRAWAL for c in log.commands)
