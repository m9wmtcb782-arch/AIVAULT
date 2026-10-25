"""單位與換算｜臨床常用 ↔ SI。

假設與適用範圍見 README ASSUMPTIONS。
虛擬模擬 ≠ 真實生物器官或主觀感受。
"""
from __future__ import annotations

# 時間
SEC_PER_MIN = 60.0
SEC_PER_HOUR = 3600.0
SEC_PER_DAY = 86400.0

# 心血管
def hr_bpm_to_hz(bpm: float) -> float:
    return bpm / SEC_PER_MIN


def co_l_per_min(hr_bpm: float, sv_ml: float) -> float:
    """CO = HR × SV；HR in bpm, SV in mL → L/min."""
    return (hr_bpm * sv_ml) / 1000.0


def map_mmhg(co_l_per_min: float, svr_mmhg_min_per_l: float, cvp_mmhg: float = 3.0) -> float:
    """MAP ≈ CO × SVR + CVP（集中參數近似）。"""
    return co_l_per_min * svr_mmhg_min_per_l + cvp_mmhg


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def clamp01(x: float) -> float:
    return clamp(x, 0.0, 1.0)
