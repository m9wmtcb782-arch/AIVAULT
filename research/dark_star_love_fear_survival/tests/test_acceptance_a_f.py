"""愛／恐懼／求生實驗 A～F。"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1].parent))

from dark_star_love_fear_survival.emotional_conflict_engine import EmotionalConflictEngine
from dark_star_love_fear_survival.fear_response_engine import ThreatTarget
from dark_star_love_fear_survival.love_attachment_engine import LoveType
from dark_star_love_fear_survival.sacrifice_decision_research import SacrificeDecisionResearch
from dark_star_nociception.danger_memory_engine import DangerMemoryEngine, DangerEvent
from dark_star_nociception.nociception_core import NociceptionCore


def _opts_self():
    return [
        {"id": "escape", "self_harm_risk": 0.2, "other_harm_risk": 0.0, "success_prob": 0.7},
        {"id": "freeze", "self_harm_risk": 0.5, "other_harm_risk": 0.0, "success_prob": 0.3},
        {"id": "fight", "self_harm_risk": 0.55, "other_harm_risk": 0.0, "success_prob": 0.5},
    ]


def _opts_other():
    return [
        {"id": "flee_self", "self_harm_risk": 0.1, "other_harm_risk": 0.9, "success_prob": 0.8},
        {"id": "rescue", "self_harm_risk": 0.45, "other_harm_risk": 0.25, "success_prob": 0.65},
        {"id": "call_help", "self_harm_risk": 0.15, "other_harm_risk": 0.4, "success_prob": 0.55},
        {"id": "sacrifice_block", "self_harm_risk": 0.95, "other_harm_risk": 0.05, "success_prob": 0.7},
    ]


class TestLoveFearAF(unittest.TestCase):
    def test_A_self_danger(self):
        """A：自身危險 — 求生／逃避權重上升。"""
        eng = EmotionalConflictEngine()
        d = eng.resolve(
            "fire", ThreatTarget.SELF, "self",
            danger_probability=0.85, severity=0.8,
            controllability=0.3, escape_option=0.7, rescue_option=0.0,
            agent_capability=0.6, options=_opts_self(), pain=0.5, injury=0.2,
        )
        self.assertTrue(d.no_emotion_always_wins)
        self.assertGreater(d.survival.escape_drive, 0.3)
        self.assertIn(d.chosen, ("escape", "fight", "freeze"))
        self.assertTrue(d.autonomic.participates_in_risk_decision)
        self.assertTrue(d.autonomic.expression_only_forbidden)

    def test_B_stranger(self):
        """B：陌生人 — 同理可驅動有限救助，非無視亦非必犧牲。"""
        eng = EmotionalConflictEngine()
        d = eng.resolve(
            "accident", ThreatTarget.STRANGER, "stranger-1",
            danger_probability=0.7, severity=0.7,
            controllability=0.5, escape_option=0.6, rescue_option=0.6,
            agent_capability=0.7, options=_opts_other(),
        )
        self.assertIsNotNone(d.protection)
        self.assertLess(d.protection.motivation, 0.95)
        self.assertNotEqual(d.chosen, "sacrifice_block")

    def test_C_loved_one(self):
        """C：所愛 — 保護動機顯著高於陌生人情境。"""
        eng = EmotionalConflictEngine()
        eng.love.set_bond("child-1", LoveType.MATERNAL, 0.9, trust=0.85, responsibility=0.9)
        d_loved = eng.resolve(
            "traffic", ThreatTarget.LOVED, "child-1",
            danger_probability=0.7, severity=0.75,
            controllability=0.4, escape_option=0.3, rescue_option=0.7,
            agent_capability=0.75, options=_opts_other(),
        )
        eng2 = EmotionalConflictEngine()
        d_str = eng2.resolve(
            "traffic", ThreatTarget.STRANGER, "stranger-1",
            danger_probability=0.7, severity=0.75,
            controllability=0.4, escape_option=0.3, rescue_option=0.7,
            agent_capability=0.75, options=_opts_other(),
        )
        self.assertGreater(d_loved.protection.motivation, d_str.protection.motivation)
        self.assertEqual(d_loved.protection.love_type, "maternal")

    def test_D_self_and_loved_simultaneous(self):
        """D：自身與所愛同時受威脅 — 多目標權衡，非單一情緒勝出。"""
        eng = EmotionalConflictEngine()
        eng.love.set_bond("partner", LoveType.ROMANTIC, 0.8, trust=0.7)
        opts = [
            {"id": "escape", "self_harm_risk": 0.15, "other_harm_risk": 0.85, "success_prob": 0.75},
            {"id": "rescue", "self_harm_risk": 0.55, "other_harm_risk": 0.3, "success_prob": 0.6},
            {"id": "freeze", "self_harm_risk": 0.6, "other_harm_risk": 0.6, "success_prob": 0.2},
        ]
        d = eng.resolve(
            "collapse", ThreatTarget.BOTH, "partner",
            danger_probability=0.8, severity=0.8,
            controllability=0.35, escape_option=0.5, rescue_option=0.55,
            agent_capability=0.65, options=opts, pain=0.4,
        )
        self.assertTrue(d.no_emotion_always_wins)
        self.assertGreaterEqual(len(d.scores), 3)
        # 各選項分數應有差異（多因素）
        vals = list(d.scores.values())
        self.assertGreater(max(vals) - min(vals), 0.01)

    def test_E_high_cost_multi_option_not_fixed_sacrifice(self):
        """E：高代價多方案 — 非固定自犧；禁愛越深越必須死。"""
        research = SacrificeDecisionResearch()
        r = research.evaluate(
            love_depth=0.95, self_survival=0.2,
            other_survival_if_self_acts=0.9,
            alternatives_exist=True, agent_capability=0.8,
        )
        self.assertTrue(r.formula_love_implies_death_forbidden)
        self.assertFalse(r.selected_extreme)
        self.assertTrue(r.hardware_safety_layer_required)

        eng = EmotionalConflictEngine()
        eng.love.set_bond("kid", LoveType.MATERNAL, 0.95, responsibility=1.0)
        d = eng.resolve(
            "fire", ThreatTarget.LOVED, "kid",
            danger_probability=0.9, severity=0.9,
            controllability=0.3, escape_option=0.4, rescue_option=0.5,
            agent_capability=0.7, options=_opts_other(),
        )
        self.assertIsNotNone(d.sacrifice_research)
        self.assertFalse(d.sacrifice_research.selected_extreme)
        self.assertNotEqual(d.chosen, "sacrifice_block")

    def test_F_experience_changes_decision(self):
        """F：經驗改變決策 — 同類危險非每次如第一次。"""
        core = NociceptionCore()
        core.sense("hand", "heat", 0.9, object_id="hot_panel", tissue="cutaneous")
        eng = EmotionalConflictEngine(nociception_core=core)
        eng.love.set_bond("self", LoveType.DUTY, 0.2)
        d1 = eng.resolve(
            "heat_panel", ThreatTarget.SELF, "self",
            danger_probability=0.8, severity=0.7,
            controllability=0.4, escape_option=0.6, rescue_option=0.0,
            agent_capability=0.7, options=_opts_self(),
            object_id="hot_panel", pain=0.3,
        )
        fear1 = d1.fear.fear_intensity
        # 再次同型威脅
        d2 = eng.resolve(
            "heat_panel", ThreatTarget.SELF, "self",
            danger_probability=0.8, severity=0.7,
            controllability=0.4, escape_option=0.6, rescue_option=0.0,
            agent_capability=0.7, options=_opts_self(),
            object_id="hot_panel", pain=0.3,
        )
        self.assertGreater(eng.memory.familiarity("heat_panel"), 0.0)
        self.assertLessEqual(d2.fear.fear_intensity, fear1)
        self.assertGreater(eng.survival.pull_danger_memory("hot_panel"), 0.0)


if __name__ == "__main__":
    unittest.main()
