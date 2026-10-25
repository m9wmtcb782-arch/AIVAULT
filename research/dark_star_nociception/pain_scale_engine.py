"""0～10 人類疼痛評估介面。

內部保留連續神經訊號；10 ≠ 死亡／昏迷／固定動作。
疼痛等級、組織損傷、保護反射、意識狀態分別計算。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class PainAssessment:
    """人類可理解的評估輸出（介面層）。"""
    nrs_0_10: float              # Numeric Rating Scale，可為小數
    band: str                    # none / mild / moderate / severe / extreme
    continuous_sensory: float    # 內部連續感覺訊號 [0, 1]
    continuous_affective: float
    tissue_injury: float         # 分別計算
    reflex_active: bool          # 分別計算
    consciousness: float         # 分別計算；疼痛不直接寫昏迷
    note: str = ""
    evidence_tier: str = "approximation"


def _band(nrs: float) -> str:
    if nrs <= 0.0:
        return "none"
    if nrs <= 3.0:
        return "mild"
    if nrs <= 6.0:
        return "moderate"
    if nrs <= 9.0:
        return "severe"
    return "extreme"


class PainScaleEngine:
    """將連續神經訊號映射到 0～10 NRS，不耦合意識／死亡。"""

    def assess(
        self,
        sensory: float,
        affective: float,
        tissue_injury: float,
        reflex_active: bool,
        consciousness: float = 1.0,
        modulation: float = 0.0,
    ) -> PainAssessment:
        if not (0.0 <= consciousness <= 1.0):
            raise ValueError("consciousness must be within [0, 1]")
        # NRS 由感覺＋情緒加權；調制可上下移動
        raw = 0.55 * sensory + 0.45 * affective
        raw = max(0.0, min(1.0, raw * (1.0 - modulation * 0.5)))
        nrs = round(raw * 10.0, 2)
        note = (
            "NRS 為人類評估尺度介面；內部為連續訊號。"
            "nrs=10 不代表死亡、昏迷或固定動作。"
        )
        if nrs >= 10.0 and consciousness >= 0.9:
            note += " 劇痛可與清醒並存。"
        return PainAssessment(
            nrs_0_10=nrs,
            band=_band(nrs),
            continuous_sensory=sensory,
            continuous_affective=affective,
            tissue_injury=tissue_injury,
            reflex_active=reflex_active,
            consciousness=consciousness,
            note=note,
        )
