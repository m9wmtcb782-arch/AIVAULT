"""恐懼反應：自身／所愛受威脅、危險機率、可控性、逃生救援、能力。

自主神經參與風險決策（非只表情）。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ThreatTarget(str, Enum):
    SELF = "self"
    LOVED = "loved"
    STRANGER = "stranger"
    BOTH = "both"


@dataclass
class FearAssessment:
    target: ThreatTarget
    danger_probability: float
    severity: float
    controllability: float
    escape_option: float
    rescue_option: float
    agent_capability: float
    fear_intensity: float
    autonomic_bias: float   # 影響風險決策的自主神經偏向
    expression_only_forbidden: bool = True
    evidence_tier: str = "approximation"


class FearResponseEngine:
    def assess(
        self,
        target: ThreatTarget,
        danger_probability: float,
        severity: float,
        controllability: float,
        escape_option: float,
        rescue_option: float,
        agent_capability: float,
        attachment_salience: float = 0.0,
    ) -> FearAssessment:
        vals = [danger_probability, severity, controllability, escape_option,
                rescue_option, agent_capability, attachment_salience]
        for v in vals:
            if not (0.0 <= v <= 1.0):
                raise ValueError("inputs must be within [0, 1]")
        # 恐懼強度：危險×嚴重度，所愛額外加成；可控／逃生降低
        base = danger_probability * severity
        loved_boost = 0.35 * attachment_salience if target in (ThreatTarget.LOVED, ThreatTarget.BOTH) else 0.0
        reduce = 0.25 * controllability + 0.2 * escape_option + 0.1 * agent_capability
        fear = max(0.0, min(1.0, base + loved_boost - reduce * 0.5))
        # 自主神經偏向：高恐懼→傾向逃避或緊急行動（參與決策，非表情）
        autonomic = min(1.0, fear * 0.7 + (1.0 - controllability) * 0.3)
        return FearAssessment(
            target=target,
            danger_probability=danger_probability,
            severity=severity,
            controllability=controllability,
            escape_option=escape_option,
            rescue_option=rescue_option,
            agent_capability=agent_capability,
            fear_intensity=fear,
            autonomic_bias=autonomic,
        )
