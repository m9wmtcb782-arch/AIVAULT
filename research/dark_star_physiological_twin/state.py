"""統一生理狀態資料結構｜可序列化／可重現。"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AutonomicTone:
    """交感／副交感相對張力（0～1，非互斥）。"""
    sympathetic: float = 0.25
    parasympathetic: float = 0.55


@dataclass
class CardioState:
    hr_bpm: float = 72.0
    sv_ml: float = 70.0
    co_l_min: float = 5.04
    map_mmhg: float = 93.0
    sbp_mmhg: float = 120.0
    dbp_mmhg: float = 80.0
    svr: float = 17.5  # mmHg·min/L
    cvp_mmhg: float = 3.0
    contractility: float = 1.0  # 相對
    phase: float = 0.0  # 0～1 收縮／舒張相位
    blood_volume_l: float = 5.0


@dataclass
class CompartmentFlow:
    name: str
    resistance: float  # 相對
    flow_l_min: float = 0.0
    o2_demand_ml_min: float = 0.0
    o2_supply_ml_min: float = 0.0
    mass_fraction: float = 0.0  # 血量分配分數


@dataclass
class CirculationState:
    compartments: Dict[str, CompartmentFlow] = field(default_factory=dict)
    total_flow_l_min: float = 5.04
    conserved_volume_l: float = 5.0


@dataclass
class RespiratoryState:
    rr_per_min: float = 14.0
    vt_l: float = 0.5
    ve_l_min: float = 7.0
    vd_l: float = 0.15  # 死腔
    va_l_min: float = 4.9
    vo2_ml_min: float = 250.0
    vco2_ml_min: float = 200.0
    spo2: float = 0.98
    tissue_o2_fraction: float = 0.95
    pao2_mmhg: float = 100.0
    paco2_mmhg: float = 40.0


@dataclass
class MetabolismState:
    glucose_mg_dl: float = 90.0
    glycogen_g: float = 100.0
    fat_energy_kcal: float = 80000.0
    insulin_au: float = 1.0  # arbitrary units, calibratable
    glucagon_au: float = 1.0
    bmr_kcal_day: float = 1400.0
    exercise_kcal_min: float = 0.0
    heat_production_w: float = 80.0
    fatigue: float = 0.1
    hunger: float = 0.2
    satiety: float = 0.5
    energy_reserve_kcal: float = 80100.0  # glycogen+glucose proxy + fat tracked separately


@dataclass
class OrganState:
    name: str
    function: float = 1.0  # 0～1
    load: float = 0.0
    notes: str = ""


@dataclass
class HomeostasisState:
    core_temp_c: float = 37.0
    glucose_mg_dl: float = 90.0
    map_mmhg: float = 93.0
    spo2: float = 0.98
    hydration: float = 1.0  # 1 = euvolemia
    na_mmol_l: float = 140.0
    k_mmol_l: float = 4.0
    energy_reserve_norm: float = 1.0
    fatigue: float = 0.1
    mode: str = "normal_adaptation"  # normal_adaptation | acute_stress | sustained_imbalance
    deviation: float = 0.0


@dataclass
class NeuralDrive:
    """來自神經／行為系統的驅動輸入（非情緒標籤寫死心率）。"""
    motor_intensity: float = 0.0  # 0 rest ～ 1 sprint
    fear_autonomic: float = 0.0
    pain_intensity: float = 0.0
    protect_arousal: float = 0.0
    attachment_calm: float = 0.0
    decision_effort: float = 0.0
    injury_load: float = 0.0


@dataclass
class BehaviorStrategy:
    """生理→行為策略輸出（端到端可測）。"""
    pace_scale: float = 1.0
    rest_preference: float = 0.0
    risk_avoidance: float = 0.0
    action_latency_scale: float = 1.0
    chosen_action: str = "continue"
    rationale: List[str] = field(default_factory=list)


@dataclass
class TwinSnapshot:
    t_s: float
    cardio: CardioState
    circulation: CirculationState
    respiratory: RespiratoryState
    metabolism: MetabolismState
    homeostasis: HomeostasisState
    organs: Dict[str, OrganState]
    autonomic: AutonomicTone
    neural_drive: NeuralDrive
    behavior: BehaviorStrategy
    paused: bool = False
    seed: int = 0
    virtual_only: bool = True
    gateway_unaffected: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


def circulation_defaults(co: float = 5.04) -> Dict[str, CompartmentFlow]:
    """靜息血流分配近似（Guyton／教科書級近似）。"""
    fracs = {
        "heart": 0.04,
        "lung": 1.0,  # 全心輸出過肺；flow 另算 = CO
        "brain": 0.14,
        "muscle": 0.20,
        "skin": 0.08,
        "kidney": 0.20,
        "splanchnic": 0.24,
        "other": 0.10,
    }
    # lung 單獨：flow = CO；其餘分數對非肺正規化
    systemic = {k: v for k, v in fracs.items() if k != "lung"}
    s = sum(systemic.values())
    out: Dict[str, CompartmentFlow] = {
        "lung": CompartmentFlow("lung", resistance=1.0, flow_l_min=co, o2_demand_ml_min=10.0, mass_fraction=0.1),
    }
    for k, f in systemic.items():
        nf = f / s
        out[k] = CompartmentFlow(
            name=k,
            resistance=1.0 / max(nf, 0.01),
            flow_l_min=co * nf,
            o2_demand_ml_min=250.0 * nf if k != "heart" else 30.0,
            mass_fraction=nf * 0.9,
        )
    return out
