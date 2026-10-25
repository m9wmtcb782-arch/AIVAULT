"""AIVAULT Dark Star：虛擬痛覺與保護學習核心（facade）。

保留 v0.1 原型可用邏輯，擴充為模組化架構。
這是計算模型，不是生物疼痛或主觀經驗。
無硬體指令、無網路呼叫、無正式頁依賴。

可選未來對接：research/darkstar-embodied Physiology Core／nerve-bus
（本分支先自洽）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from .danger_memory_engine import DangerEvent, DangerMemoryEngine
from .injury_recovery_engine import InjuryRecoveryEngine
from .neural_signal_engine import NeuralSignalEngine
from .nociceptor_engine import (
    NociceptorEngine,
    StimulusKind,
    TissueClass,
)
from .pain_behavior_bridge import BehaviorIntent, PainBehaviorBridge
from .pain_modulation_engine import PainModulationEngine
from .pain_scale_engine import PainAssessment, PainScaleEngine
from .robot_sensory_adapter import RobotSensoryAdapter
from .spinal_reflex_engine import ReflexLog, SpinalReflexEngine


# ---- 向後相容資料結構（保留原型欄位）----

@dataclass
class BodySite:
    sensitivity: float = 1.0
    injury: float = 0.0
    sensitization: float = 0.0


@dataclass
class NociceptiveEvent:
    site: str
    stimulus: str
    magnitude: float
    a_delta: float
    c_fiber: float
    withdrawal: bool
    threat: float
    injury: float
    # 擴充欄位（可選讀取）
    tissue: str = "cutaneous"
    nrs: float = 0.0
    behavior: Optional[BehaviorIntent] = None
    time_features: Optional[dict] = None
    reflex_log: Optional[ReflexLog] = None
    assessment: Optional[PainAssessment] = None


_STIMULUS_MAP = {
    "heat": StimulusKind.HEAT,
    "cold": StimulusKind.COLD,
    "pressure": StimulusKind.PRESSURE,
    "chemical": StimulusKind.CHEMICAL,
    "puncture": StimulusKind.PUNCTURE,
    "cut": StimulusKind.CUT,
    "stretch": StimulusKind.STRETCH,
    "impact": StimulusKind.IMPACT,
    "ischemia": StimulusKind.ISCHEMIA,
    "inflammation": StimulusKind.INFLAMMATION,
    "distension": StimulusKind.DISTENSION,
    "abnormal_load": StimulusKind.ABNORMAL_LOAD,
    "ectopic": StimulusKind.ECTOPIC,
}

_TISSUE_MAP = {
    "cutaneous": TissueClass.CUTANEOUS,
    "muscle": TissueClass.MUSCLE,
    "bone_joint": TissueClass.BONE_JOINT,
    "visceral": TissueClass.VISCERAL,
    "neuropathic": TissueClass.NEUROPATHIC,
    "inflammatory": TissueClass.INFLAMMATORY,
}


@dataclass
class NociceptionCore:
    """Facade：串接傷害感受→神經→反射→評分→損傷→危險記憶→行為。"""

    sites: Dict[str, BodySite] = field(default_factory=dict)
    danger_memory: Dict[Tuple[str, str], float] = field(default_factory=dict)
    reflex_threshold: float = 0.55
    embodiment_id: str = "virtual-default"

    def __post_init__(self) -> None:
        self.nociceptors = NociceptorEngine()
        self.neural = NeuralSignalEngine()
        self.reflexes = SpinalReflexEngine(withdrawal_threshold=self.reflex_threshold)
        self.scale = PainScaleEngine()
        self.modulation = PainModulationEngine()
        self.injury = InjuryRecoveryEngine()
        self.danger = DangerMemoryEngine()
        self.behavior = PainBehaviorBridge()
        self.robot = RobotSensoryAdapter(embodiment_id=self.embodiment_id)
        # 同步舊 danger_memory dict
        for k, v in self.danger_memory.items():
            self.danger.threat_index[k] = v

    def sense(
        self,
        site: str,
        stimulus: str,
        intensity: float,
        context_modulation: float = 0.0,
        tissue: str = "cutaneous",
        duration_s: float = 0.2,
        object_id: Optional[str] = None,
        environment: Optional[dict] = None,
        consciousness: float = 1.0,
    ) -> NociceptiveEvent:
        if not (0.0 <= intensity <= 1.0):
            raise ValueError("intensity must be within [0, 1]")
        if not (-0.5 <= context_modulation <= 0.5):
            raise ValueError("context_modulation must be within [-0.5, 0.5]")

        stim = _STIMULUS_MAP.get(stimulus)
        if stim is None:
            raise ValueError(f"unsupported stimulus: {stimulus}")
        tissue_cls = _TISSUE_MAP.get(tissue, TissueClass.CUTANEOUS)

        body = self.sites.setdefault(site, BodySite())
        # 原型相容：把 BodySite 敏化寫入感受器
        nstate = self.nociceptors.ensure_site(site, tissue_cls)
        nstate.sensitization = max(nstate.sensitization, body.sensitization)
        nstate.baseline_threshold = max(0.05, 0.25 / max(body.sensitivity, 0.1))

        self.modulation.set(descending=context_modulation)
        self.neural.set_descending(self.modulation.descending_for_neural())

        firing = self.nociceptors.fire(site, tissue_cls, stim, intensity)
        pipe = self.neural.process(firing)

        # 調制淨增益
        gain = self.modulation.net_gain()
        mod_ad = min(1.0, pipe.modulated_a_delta * gain)
        mod_c = min(1.0, pipe.modulated_c * gain)
        sensory = min(1.0, pipe.ascending.sensory * gain)
        affective = min(1.0, pipe.ascending.affective * gain)

        reflex_log = self.reflexes.evaluate(
            site, mod_ad, mod_c, tissue_hint=tissue_cls.value,
        )
        withdrawal = self.reflexes.triggered_withdrawal(reflex_log)

        inj = self.injury.apply_damage(site, tissue_cls.value, firing.effective)
        body.injury = inj.severity
        body.sensitization = max(body.sensitization, nstate.sensitization)

        assessment = self.scale.assess(
            sensory=sensory,
            affective=affective,
            tissue_injury=inj.severity,
            reflex_active=withdrawal,
            consciousness=consciousness,
            modulation=context_modulation,
        )

        threat = max(0.0, min(1.0, 0.55 * mod_ad + 0.45 * mod_c + context_modulation))
        env = dict(environment or {})
        if object_id:
            env["object_id"] = object_id

        # 先反射，再寫危險記憶（高階）
        self.danger.record(DangerEvent(
            stimulus_source=object_id or stimulus,
            stimulus_type=stimulus,
            body_site=site,
            intensity=intensity,
            duration_s=duration_s,
            body_state={"sensitization": body.sensitization, "injury": body.injury},
            reflex_result={"withdrawal": withdrawal, "commands": [
                c.reflex.value for c in reflex_log.commands
            ]},
            tissue_injury=inj.severity,
            recovery_snapshot={"mobility": self.injury.mobility_factor(site)},
            environment_features=env,
            agent_action="reflex_then_encode",
            embodiment_id=self.embodiment_id,
        ))
        # 同步舊 API dict
        key = (site, stimulus)
        self.danger_memory[key] = self.danger.predict_risk(site, stimulus)
        self.robot.share_danger_memory(self.danger.object_threat)

        behavior = self.behavior.build(
            a_delta=mod_ad,
            c_fiber=mod_c,
            nrs=assessment.nrs_0_10,
            reflex_withdrawal=withdrawal,
            mobility_factor=self.injury.mobility_factor(site),
            site=site,
            spatial_spread=firing.profile.spatial_spread,
            affective=affective,
        )

        return NociceptiveEvent(
            site=site,
            stimulus=stimulus,
            magnitude=intensity,
            a_delta=mod_ad,
            c_fiber=mod_c,
            withdrawal=withdrawal,
            threat=threat,
            injury=body.injury,
            tissue=tissue_cls.value,
            nrs=assessment.nrs_0_10,
            behavior=behavior,
            time_features=pipe.time_features,
            reflex_log=reflex_log,
            assessment=assessment,
        )

    def predict_risk(self, site: str, stimulus: str) -> float:
        return self.danger.predict_risk(site, stimulus)

    def predict_before_contact(
        self, site: str, stimulus: str, object_id: Optional[str] = None,
    ) -> dict:
        return self.danger.should_avoid_before_contact(site, stimulus, object_id)

    def recover(self, fraction: float = 0.1) -> None:
        if not (0.0 <= fraction <= 1.0):
            raise ValueError("fraction must be within [0, 1]")
        for body in self.sites.values():
            body.injury *= (1 - fraction)
            body.sensitization *= (1 - fraction)
        self.injury.recover(fraction)

    def reembody(self, new_id: str, sensor_map: Optional[dict] = None) -> dict:
        """換虛擬身體：保留危險記憶，重新校準感測／運動。"""
        retained = self.danger.retain_across_embodiment()
        self.embodiment_id = new_id
        cal = self.robot.begin_embodiment_recalibration(new_id, sensor_map or {})
        self.danger.import_retained(retained)
        self.robot.share_danger_memory(retained)
        # 部位感測狀態需重校；危險物件記憶保留
        self.nociceptors = NociceptorEngine()
        self.sites.clear()
        return {
            "embodiment_id": new_id,
            "danger_retained": dict(retained),
            "calibrated": cal.calibrated,
            "needs_recalibration": True,
            "hardware_locked": self.robot.reflex_interface_locked(),
        }
