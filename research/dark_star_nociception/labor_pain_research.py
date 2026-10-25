"""分娩疼痛研究模型（獨立生理研究情境）。

不強制暗星進入懷孕／分娩狀態。
禁止假設所有分娩必然達到 NRS 10。
證據分級：hypothesis／approximation（研究用簡化）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class LaborStage(str, Enum):
    LATENT = "latent"          # 潛伏期
    ACTIVE = "active"          # 活動期
    TRANSITION = "transition"  # 過渡期
    SECOND = "second"          # 第二產程
    THIRD = "third"            # 第三產程


@dataclass
class LaborInputs:
    """可分別調整的研究輸入。"""
    uterine_contraction: float = 0.0   # 子宮收縮 [0,1]
    cervical_dilation_cm: float = 0.0  # 0～10 cm
    pelvic_floor_load: float = 0.0     # 骨盆底／會陰壓迫伸展
    perineal_stretch: float = 0.0
    stage: LaborStage = LaborStage.LATENT
    stress: float = 0.3
    relief_factor: float = 0.0         # 緩解（藥物／非藥物模擬）[0,1]
    individual_sensitivity: float = 1.0  # 個體差異


@dataclass
class LaborPainBreakdown:
    visceral_from_contraction: float
    visceral_from_dilation: float
    somatic_from_pelvic: float
    somatic_from_perineum: float
    combined_continuous: float
    nrs_estimate: float
    stage: LaborStage
    notes: List[str] = field(default_factory=list)
    evidence_tier: str = "hypothesis"
    forces_pregnancy_state: bool = False  # 永遠 False：獨立研究


class LaborPainResearch:
    """分娩痛來源分解；輸出研究訊號，不寫入懷孕狀態機。"""

    STAGE_WEIGHTS = {
        LaborStage.LATENT: {"contraction": 0.7, "dilation": 0.4, "pelvic": 0.1, "perineum": 0.05},
        LaborStage.ACTIVE: {"contraction": 0.85, "dilation": 0.75, "pelvic": 0.25, "perineum": 0.1},
        LaborStage.TRANSITION: {"contraction": 0.95, "dilation": 0.9, "pelvic": 0.45, "perineum": 0.25},
        LaborStage.SECOND: {"contraction": 0.7, "dilation": 0.5, "pelvic": 0.9, "perineum": 0.85},
        LaborStage.THIRD: {"contraction": 0.4, "dilation": 0.2, "pelvic": 0.35, "perineum": 0.3},
    }

    def evaluate(self, inputs: LaborInputs) -> LaborPainBreakdown:
        for name, val in [
            ("uterine_contraction", inputs.uterine_contraction),
            ("pelvic_floor_load", inputs.pelvic_floor_load),
            ("perineal_stretch", inputs.perineal_stretch),
            ("stress", inputs.stress),
            ("relief_factor", inputs.relief_factor),
        ]:
            if not (0.0 <= val <= 1.0):
                raise ValueError(f"{name} must be within [0, 1]")
        if not (0.0 <= inputs.cervical_dilation_cm <= 10.0):
            raise ValueError("cervical_dilation_cm must be within [0, 10]")
        if not (0.5 <= inputs.individual_sensitivity <= 1.5):
            raise ValueError("individual_sensitivity must be within [0.5, 1.5]")

        w = self.STAGE_WEIGHTS[inputs.stage]
        dil_norm = inputs.cervical_dilation_cm / 10.0

        v_con = inputs.uterine_contraction * w["contraction"]
        v_dil = dil_norm * w["dilation"]
        s_pel = inputs.pelvic_floor_load * w["pelvic"]
        s_per = inputs.perineal_stretch * w["perineum"]

        # 內臟 vs 軀體
        visceral = min(1.0, 0.6 * v_con + 0.5 * v_dil)
        somatic = min(1.0, 0.55 * s_pel + 0.55 * s_per)
        combined = min(1.0, 0.55 * visceral + 0.45 * somatic)

        # 壓力／情緒促進；緩解抑制；個體差異
        combined = combined * (1.0 + 0.25 * inputs.stress) * (1.0 - 0.55 * inputs.relief_factor)
        combined = min(1.0, combined * inputs.individual_sensitivity)

        nrs = round(combined * 10.0, 2)
        notes = [
            "獨立研究情境：不強制暗星進入懷孕狀態。",
            "不得假設所有分娩必然達到 NRS 10；部分個體可評 9～10，但非必然。",
            f"內臟分量={visceral:.3f}，軀體分量={somatic:.3f}。",
            "證據分級：hypothesis／approximation，非臨床預測工具。",
        ]
        if nrs >= 9.0:
            notes.append("本組參數下 NRS 偏高；更換個體差異／緩解可降低。")

        return LaborPainBreakdown(
            visceral_from_contraction=v_con,
            visceral_from_dilation=v_dil,
            somatic_from_pelvic=s_pel,
            somatic_from_perineum=s_per,
            combined_continuous=combined,
            nrs_estimate=nrs,
            stage=inputs.stage,
            notes=notes,
            forces_pregnancy_state=False,
        )
