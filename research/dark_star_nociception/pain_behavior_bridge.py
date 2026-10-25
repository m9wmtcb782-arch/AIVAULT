"""疼痛→行為橋接：縮手／姿態／表情鉤子／呼吸語音／注意力／速度／傷後保護。

禁止固定動畫替換；輸出控制意圖與連續參數。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class BehaviorIntent:
    """給運動／表情／語音控制器的連續意圖（非動畫檔名）。"""
    withdrawal: float = 0.0
    posture_guard: float = 0.0
    expression_tension: float = 0.0      # 表情鉤子：張力參數
    gaze_aversion: float = 0.0
    breath_rate_scale: float = 1.0       # >1 加快
    voice_strain: float = 0.0
    attention_narrowing: float = 0.0
    movement_speed_scale: float = 1.0    # <1 變慢
    range_of_motion_scale: float = 1.0
    protective_favor_site: Optional[str] = None
    motor_hints: List[str] = field(default_factory=list)
    animation_forbidden: bool = True     # 明確禁止以固定動畫冒充
    evidence_tier: str = "approximation"


class PainBehaviorBridge:
    def build(
        self,
        a_delta: float,
        c_fiber: float,
        nrs: float,
        reflex_withdrawal: bool,
        mobility_factor: float = 1.0,
        site: str = "",
        spatial_spread: float = 0.2,
        affective: float = 0.0,
    ) -> BehaviorIntent:
        withdrawal = 1.0 if reflex_withdrawal else min(1.0, a_delta * 1.1)
        guard = min(1.0, 0.5 * a_delta + 0.5 * c_fiber)
        tension = min(1.0, nrs / 10.0 * 0.7 + affective * 0.3)
        gaze = min(1.0, affective * 0.5 + (nrs / 10.0) * 0.3)
        breath = 1.0 + min(0.8, nrs / 10.0 * 0.6 + a_delta * 0.2)
        voice = min(1.0, nrs / 10.0 * 0.5 + c_fiber * 0.3)
        attention = min(1.0, nrs / 10.0 * 0.6 + spatial_spread * 0.2)
        speed = max(0.25, 1.0 - nrs / 10.0 * 0.45 - (1.0 - mobility_factor) * 0.4)
        rom = max(0.2, mobility_factor * (1.0 - guard * 0.3))
        hints = []
        if withdrawal > 0.5:
            hints.append("withdraw_effector_from_stimulus")
        if guard > 0.4:
            hints.append("increase_local_muscle_tone")
        if rom < 0.7:
            hints.append("limit_range_favor_injured_site")
        return BehaviorIntent(
            withdrawal=withdrawal,
            posture_guard=guard,
            expression_tension=tension,
            gaze_aversion=gaze,
            breath_rate_scale=breath,
            voice_strain=voice,
            attention_narrowing=attention,
            movement_speed_scale=speed,
            range_of_motion_scale=rom,
            protective_favor_site=site or None,
            motor_hints=hints,
            animation_forbidden=True,
        )
