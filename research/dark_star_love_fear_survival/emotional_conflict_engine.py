"""情緒衝突核心：愛+恐懼+求生+保護+疼痛+依附+風險。

流程：感知→辨識受威脅者→情緒生理→預測後果→比較代價→選擇→觀察→記憶。
禁止某一情緒永遠勝出。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .autonomic_response_bridge import AutonomicDecisionBias, AutonomicResponseBridge
from .conflict_memory_engine import ConflictEvent, ConflictMemoryEngine
from .empathy_altruism_engine import EmpathyAltruismEngine
from .fear_response_engine import FearAssessment, FearResponseEngine, ThreatTarget
from .love_attachment_engine import LoveAttachmentEngine, LoveType
from .moral_decision_engine import MoralDecisionEngine
from .protective_motivation_engine import ProtectiveMotivation, ProtectiveMotivationEngine
from .risk_consequence_predictor import OptionForecast, RiskConsequencePredictor
from .sacrifice_decision_research import SacrificeDecisionResearch, SacrificeResearchResult
from .survival_instinct_engine import SurvivalInstinctEngine, SurvivalState


@dataclass
class ConflictDecision:
    threatened_party: str
    fear: FearAssessment
    survival: SurvivalState
    protection: Optional[ProtectiveMotivation]
    autonomic: AutonomicDecisionBias
    forecasts: List[OptionForecast]
    chosen: str
    scores: Dict[str, float]
    sacrifice_research: Optional[SacrificeResearchResult]
    no_emotion_always_wins: bool = True
    memory_recorded: bool = False
    pending_research: List[str] = field(default_factory=lambda: [
        "multi_agent_live_scenario",
        "calibrated_human_subject_study",
        "robot_hardware_safety_integration",
    ])


class EmotionalConflictEngine:
    def __init__(self, nociception_core: Any = None) -> None:
        self.love = LoveAttachmentEngine()
        self.fear = FearResponseEngine()
        self.survival = SurvivalInstinctEngine(nociception_core)
        self.protect = ProtectiveMotivationEngine(self.love)
        self.empathy = EmpathyAltruismEngine()
        self.risk = RiskConsequencePredictor()
        self.moral = MoralDecisionEngine()
        self.autonomic = AutonomicResponseBridge()
        self.memory = ConflictMemoryEngine()
        self.sacrifice = SacrificeDecisionResearch()

    def resolve(
        self,
        threat_type: str,
        threatened: ThreatTarget,
        target_id: str,
        danger_probability: float,
        severity: float,
        controllability: float,
        escape_option: float,
        rescue_option: float,
        agent_capability: float,
        options: List[dict],
        pain: float = 0.0,
        injury: float = 0.0,
        object_id: Optional[str] = None,
    ) -> ConflictDecision:
        # 1 感知／危險記憶
        known = self.survival.pull_danger_memory(object_id) if object_id else 0.0
        # 2 辨識受威脅者＋依附
        bond = self.love.get(target_id)
        attach = self.love.protective_weight(target_id) / 1.5 if bond else 0.0
        is_loved = bond is not None and bond.strength > 0.3

        # 3 恐懼（熟悉度調節）
        fear_raw = self.fear.assess(
            threatened, danger_probability, severity, controllability,
            escape_option, rescue_option, agent_capability, attachment_salience=min(1.0, attach),
        )
        adj_fear = self.memory.adjust_fear(threat_type, fear_raw.fear_intensity)
        fear_raw.fear_intensity = adj_fear
        fear_raw.autonomic_bias = min(1.0, adj_fear * 0.7 + (1.0 - controllability) * 0.3)

        # 4 求生
        surv = self.survival.update_from_threat(severity, pain, injury, known)

        # 5 保護動機
        prot = None
        if threatened in (ThreatTarget.LOVED, ThreatTarget.STRANGER, ThreatTarget.BOTH):
            emp = self.empathy.toward(is_loved, severity)
            prot = self.protect.evaluate(
                target_id=target_id,
                need_help=severity,
                severity=severity,
                can_rescue=min(1.0, rescue_option * agent_capability),
                can_improve=controllability,
                alternatives=escape_option if threatened != ThreatTarget.SELF else 0.5,
                inaction_cost=severity * (0.8 if is_loved else 0.4) * emp,
            )

        # 6 預測後果
        forecasts = self.risk.forecast(options)
        moral = self.moral.rank(forecasts)

        # 7 比較代價：多訊號加權 — 禁單一情緒永遠勝出
        scores: Dict[str, float] = {}
        for f in forecasts:
            # 求生分量
            survive_s = (1.0 - f.self_harm_risk) * surv.self_priority
            # 保護分量
            protect_s = f.expected_benefit * (prot.motivation if prot else 0.2)
            # 恐懼／逃走
            flee_s = f.self_harm_risk * (-0.5) + (1.0 if "flee" in f.option_id or "escape" in f.option_id else 0.0) * fear_raw.fear_intensity * 0.4
            # 道德
            m = next((x.moral_score for x in moral if x.option_id == f.option_id), 0.0)
            # 自主神經：freeze 降低所有行動分
            auto = self.autonomic.bias(fear_raw.fear_intensity, fear_raw.autonomic_bias, prot.motivation if prot else 0.0)
            freeze_pen = auto.freeze * 0.25
            scores[f.option_id] = survive_s * 0.3 + protect_s * 0.3 + flee_s * 0.15 + m * 0.25 - freeze_pen

        chosen = max(scores, key=scores.get) if scores else "freeze"
        auto_bias = self.autonomic.bias(
            fear_raw.fear_intensity, fear_raw.autonomic_bias, prot.motivation if prot else 0.0,
        )

        # 犧牲研究（不強制）
        sac = None
        if any("sacrifice" in o.get("id", "") for o in options):
            sac = self.sacrifice.evaluate(
                love_depth=bond.strength if bond else 0.0,
                self_survival=1.0 - severity * (1.0 if threatened in (ThreatTarget.SELF, ThreatTarget.BOTH) else 0.3),
                other_survival_if_self_acts=1.0 - min(
                    (o for o in options if "sacrifice" in o["id"]),
                    key=lambda x: x.get("other_harm_risk", 1),
                ).get("other_harm_risk", 1) if any("sacrifice" in o["id"] for o in options) else 0.5,
                alternatives_exist=any(
                    "sacrifice" not in o["id"] and o.get("success_prob", 0) > 0.4 for o in options
                ),
                agent_capability=agent_capability,
            )
            if sac and not sac.selected_extreme and chosen.startswith("sacrifice"):
                # 覆蓋：有替代時不選極端
                non = [k for k in scores if not k.startswith("sacrifice")]
                if non:
                    chosen = max(non, key=lambda k: scores[k])

        # 8 觀察（簡化）＋ 9 記憶
        outcome = {"chosen": chosen, "success_est": next(
            (f.success_prob for f in forecasts if f.option_id == chosen), 0.0)}
        self.memory.record(ConflictEvent(
            threat_type=threat_type,
            threatened_party=threatened.value,
            perceived_danger=danger_probability * severity,
            options_considered=[o["id"] for o in options],
            chosen_action=chosen,
            predicted_consequence={"scores": scores},
            observed_outcome=outcome,
            emotions={
                "fear": fear_raw.fear_intensity,
                "protect": prot.motivation if prot else 0.0,
                "survival": surv.escape_drive,
            },
            love_type=bond.love_type.value if bond else None,
            self_cost=next((f.self_harm_risk for f in forecasts if f.option_id == chosen), 0),
            other_benefit=next((f.expected_benefit for f in forecasts if f.option_id == chosen), 0),
        ))

        return ConflictDecision(
            threatened_party=threatened.value,
            fear=fear_raw,
            survival=surv,
            protection=prot,
            autonomic=auto_bias,
            forecasts=forecasts,
            chosen=chosen,
            scores=scores,
            sacrifice_research=sac,
            memory_recorded=True,
        )
