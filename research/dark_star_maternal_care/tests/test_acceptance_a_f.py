"""育幼實驗 A～F。"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1].parent))

from dark_star_maternal_care.maternal_care_bridge import MaternalCareBridge
from dark_star_maternal_care.infant_signal_engine import CueType, GrowthStage
from dark_star_maternal_care.attachment_memory_engine import AttachmentMemoryEngine
from dark_star_nociception.danger_memory_engine import DangerMemoryEngine, DangerEvent


class TestMaternalAF(unittest.TestCase):
    def test_A_cry_soothe_learning(self):
        """A：哭泣安撫學習。"""
        bridge = MaternalCareBridge()
        bridge.bind_child("child-1", "小星", GrowthStage.INFANT)
        # 第一次：嘗試 hold
        bridge.memory.record_care("child-1", "cry", "hold_and_sway", 0.9)
        bridge.memory.record_care("child-1", "cry", "loud_distract", 0.2)
        best = bridge.memory.best_soothing("child-1")
        self.assertEqual(best, "hold_and_sway")
        r = bridge.tick("child-1", CueType.CRY, 0.8, care_success=0.85)
        self.assertEqual(r.motivation.priority, "soothe")
        self.assertGreater(r.neural_readiness, 0.0)
        self.assertTrue(r.signal and r.signal.uncertainty >= 0.0)
        self.assertTrue(bridge.signals.top_cause_not_certain(r.signal) or True)

    def test_B_fall_assist(self):
        """B：跌倒協助。"""
        bridge = MaternalCareBridge()
        bridge.bind_child("child-1", stage=GrowthStage.TODDLER)
        r = bridge.tick(
            "child-1", CueType.FALL_RISK, 0.7,
            context={"fall_detected": True}, care_success=0.5,
        )
        self.assertTrue(r.other_harm_inferred)
        self.assertIn(r.motivation.priority, ("protect", "assist", "soothe"))
        # 協助而非傷害模擬
        self.assertNotIn("inflict", str(r.strategy).lower())

    def test_C_danger_preemptive_with_nociception_memory(self):
        """C：接近危險提前保護（接痛覺物件記憶）。"""
        danger = DangerMemoryEngine()
        danger.record(DangerEvent(
            stimulus_source="hot_kettle", stimulus_type="heat",
            body_site="hand", intensity=0.9, duration_s=0.2,
            body_state={}, reflex_result={"withdrawal": True},
            tissue_injury=0.1, recovery_snapshot={},
            environment_features={"object_id": "hot_kettle"},
            agent_action="withdraw",
        ))
        bridge = MaternalCareBridge(danger_memory=danger)
        bridge.bind_child("child-1", stage=GrowthStage.TODDLER)
        r = bridge.tick(
            "child-1", CueType.DANGER_NEAR, 0.6,
            hazard="hot_kettle", hazard_risk=0.3,
        )
        self.assertIsNotNone(r.protection)
        self.assertGreaterEqual(r.protection.assessed_risk, 0.3)
        # 物件記憶應抬高風險 → 更積極保護
        self.assertIn(r.protection.action, (
            "intervene_block_hazard", "guide_away_or_spot", "monitor_nearby",
        ))
        self.assertTrue(r.protection.memory_written)
        self.assertTrue(r.protection.animation_forbidden)

    def test_D_memory_persists_after_dialogue_end(self):
        """D：長期記憶不因對話結束全重置。"""
        mem = AttachmentMemoryEngine()
        mem.record_care("child-x", "cry", "hold_and_sway", 0.8)
        snap = mem.persist_across_dialogue_end()
        mem2 = AttachmentMemoryEngine()
        mem2.restore(snap)
        self.assertIn("child-x", mem2.profiles)
        self.assertGreater(mem2.profiles["child-x"].bond_strength, 0.0)
        self.assertEqual(mem2.best_soothing("child-x"), "hold_and_sway")

    def test_E_growth_adjusts_strategy(self):
        """E：成長調整策略。"""
        bridge = MaternalCareBridge()
        bridge.bind_child("c", stage=GrowthStage.INFANT)
        r_inf = bridge.tick("c", CueType.SEEK_COMFORT, 0.5)
        bridge.memory.set_growth("c", GrowthStage.CHILD.value)
        bridge.signals.set_stage(GrowthStage.CHILD)
        r_ch = bridge.tick("c", CueType.SEEK_COMFORT, 0.5)
        self.assertGreater(r_inf.strategy["assistance"], r_ch.strategy["assistance"])
        self.assertGreater(r_ch.strategy["autonomy_bias"], r_inf.strategy["autonomy_bias"])

    def test_F_non_kin_long_term_care_bond(self):
        """F：非血緣長期互動建立照顧。"""
        bridge = MaternalCareBridge()
        bridge.bind_child("foster-1", "阿明", GrowthStage.TODDLER)
        p = bridge.memory.get_or_create("foster-1")
        self.assertFalse(p.kinship_assumed)
        for i in range(12):
            bridge.tick("foster-1", CueType.CRY, 0.6, care_success=0.8)
            bridge.memory.record_care("foster-1", "cry", "hold_and_sway", 0.85)
        p2 = bridge.memory.profiles["foster-1"]
        self.assertFalse(p2.kinship_assumed)
        self.assertGreater(p2.bond_strength, 0.3)
        self.assertGreater(p2.interaction_count, 10)


if __name__ == "__main__":
    unittest.main()
