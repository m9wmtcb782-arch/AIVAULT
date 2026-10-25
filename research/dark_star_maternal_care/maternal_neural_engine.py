"""育幼神經引擎：下丘腦／杏仁核／多巴胺／催產素／泌乳素相關／前額葉／海馬。

多機制交互，禁止單一荷爾蒙開關。
證據分級：approximation／hypothesis。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class MaternalNeuralState:
    hypothalamic_care_drive: float = 0.0   # 下丘腦育幼驅動
    amygdala_salience: float = 0.0         # 嬰兒訊號突顯
    dopamine_reward: float = 0.0           # 照顧成功獎賞
    oxytocin_bond: float = 0.0             # 連結（非開關）
    prolactin_related: float = 0.0         # 相關準備度（虛擬近似）
    prefrontal_regulation: float = 0.5     # 前額葉調節／計畫
    hippocampal_relation: float = 0.0      # 關係記憶喚起
    stress: float = 0.2
    fatigue: float = 0.1
    evidence_tier: str = "approximation"


class MaternalNeuralEngine:
    def __init__(self) -> None:
        self.state = MaternalNeuralState()

    def update(
        self,
        infant_distress: float = 0.0,
        care_success: float = 0.0,
        proximity: float = 0.0,
        familiar_bond: float = 0.0,
        threat_to_infant: float = 0.0,
        dt: float = 1.0,
    ) -> MaternalNeuralState:
        s = self.state
        # 多通道耦合，非單一荷爾蒙
        s.amygdala_salience = min(1.0, 0.55 * infant_distress + 0.7 * threat_to_infant
                                  + 0.2 * s.amygdala_salience)
        s.hypothalamic_care_drive = min(1.0, (
            0.4 * s.amygdala_salience
            + 0.25 * familiar_bond
            + 0.2 * proximity
            + 0.15 * s.oxytocin_bond
            - 0.2 * s.fatigue
        ))
        s.dopamine_reward = min(1.0, 0.6 * care_success + 0.3 * s.dopamine_reward)
        # 催產素隨互動累積，受壓力抑制
        s.oxytocin_bond = min(1.0, s.oxytocin_bond * 0.98
                              + (0.08 * proximity + 0.1 * care_success) * (1.0 - 0.4 * s.stress) * dt)
        s.prolactin_related = min(1.0, 0.5 * s.oxytocin_bond + 0.2 * familiar_bond)
        # 前額葉：調節衝動、規劃協助程度
        s.prefrontal_regulation = max(0.15, min(1.0,
            0.55 + 0.25 * (1.0 - s.stress) - 0.2 * s.fatigue + 0.1 * s.dopamine_reward))
        s.hippocampal_relation = min(1.0, 0.7 * familiar_bond + 0.3 * s.oxytocin_bond)
        return s

    def care_readiness(self) -> float:
        s = self.state
        return max(0.0, min(1.0,
            0.3 * s.hypothalamic_care_drive
            + 0.2 * s.oxytocin_bond
            + 0.15 * s.dopamine_reward
            + 0.15 * s.prefrontal_regulation
            + 0.1 * s.amygdala_salience
            + 0.1 * s.hippocampal_relation
            - 0.15 * s.fatigue
        ))
