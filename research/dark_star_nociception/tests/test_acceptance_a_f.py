"""驗收測試 A～F：自動化單元＋整合。"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))

from dark_star_nociception.nociception_core import NociceptionCore
from dark_star_nociception.nociceptor_engine import (
    NociceptorEngine,
    StimulusKind,
    TissueClass,
)
from dark_star_nociception.labor_pain_research import (
    LaborInputs,
    LaborPainResearch,
    LaborStage,
)
from dark_star_nociception.pain_scale_engine import PainScaleEngine


class TestAcceptanceAF(unittest.TestCase):
    def test_A_heat_signal_reflex_danger_record(self):
        """A：高溫接觸 → 訊號↑＋保護反射＋危險記錄。"""
        core = NociceptionCore()
        ev = core.sense(
            site="right_hand",
            stimulus="heat",
            intensity=0.9,
            tissue="cutaneous",
            object_id="hot_kettle",
            environment={"surface_temp_norm": 0.95},
        )
        self.assertGreater(ev.a_delta, 0.5)
        self.assertTrue(ev.withdrawal)
        self.assertGreater(ev.threat, 0.4)
        self.assertGreater(core.predict_risk("right_hand", "heat"), 0.0)
        self.assertIn("hot_kettle", core.danger.object_threat)
        self.assertTrue(ev.reflex_log.cognition_deferred)
        self.assertTrue(ev.behavior.animation_forbidden)

    def test_B_reencounter_predict_avoid_before_contact(self):
        """B：再遇高溫 → 接觸前預測避開／保護。"""
        core = NociceptionCore()
        core.sense(
            site="right_hand", stimulus="heat", intensity=0.92,
            object_id="hot_kettle", tissue="cutaneous",
        )
        pred = core.predict_before_contact(
            "right_hand", "heat", object_id="hot_kettle",
        )
        self.assertTrue(pred["before_contact"])
        self.assertTrue(pred["avoid"] or pred["protect"])
        self.assertGreaterEqual(pred["risk"], 0.45)
        self.assertIn(pred["action"], ("avoid", "protect"))

    def test_C_same_intensity_different_time_features(self):
        """C：同強度皮膚／肌肉／內臟 → 不同時間特徵與行為影響。"""
        engine = NociceptorEngine()
        intensity = 0.75
        cut = engine.fire("hand", TissueClass.CUTANEOUS, StimulusKind.HEAT, intensity)
        mus = engine.fire("forearm", TissueClass.MUSCLE, StimulusKind.IMPACT, intensity)
        vis = engine.fire("abdomen", TissueClass.VISCERAL, StimulusKind.DISTENSION, intensity)

        self.assertNotEqual(cut.profile.a_delta_peak_ms, vis.profile.a_delta_peak_ms)
        self.assertNotEqual(cut.profile.c_peak_ms, mus.profile.c_peak_ms)
        self.assertGreater(vis.profile.spatial_spread, cut.profile.spatial_spread)
        self.assertGreater(vis.profile.affective_weight, cut.profile.affective_weight)
        # 皮膚 Aδ 相對較強；內臟 C 相對較強
        self.assertGreater(cut.a_delta_drive / max(cut.c_fiber_drive, 1e-6),
                           vis.a_delta_drive / max(vis.c_fiber_drive, 1e-6))

        core = NociceptionCore()
        e_cut = core.sense("hand", "heat", intensity, tissue="cutaneous")
        e_vis = core.sense("abdomen", "distension", intensity, tissue="visceral")
        self.assertNotEqual(
            e_cut.time_features["c_peak_ms"],
            e_vis.time_features["c_peak_ms"],
        )
        # 行為：內臟空間擴散／情緒影響較高 → attention 或 expression 傾向不同
        self.assertNotAlmostEqual(
            e_cut.behavior.attention_narrowing,
            e_vis.behavior.attention_narrowing,
            places=2,
        )

    def test_D_sensitization_different_response(self):
        """D：敏化 — 組織狀態不同 → 不同神經反應。"""
        engine = NociceptorEngine()
        site = "left_forearm"
        first = engine.fire(site, TissueClass.CUTANEOUS, StimulusKind.HEAT, 0.55)
        # 人工提高敏化
        engine.set_sensitization(site, 0.8)
        second = engine.fire(site, TissueClass.CUTANEOUS, StimulusKind.HEAT, 0.55)
        self.assertGreater(second.effective, first.effective)
        self.assertGreater(second.a_delta_drive, first.a_delta_drive)

        # 發炎組織
        engine2 = NociceptorEngine()
        engine2.ensure_site("skin_a", TissueClass.INFLAMMATORY)
        engine2.set_inflammation("skin_a", 0.7)
        inflamed = engine2.fire(
            "skin_a", TissueClass.INFLAMMATORY, StimulusKind.PRESSURE, 0.5,
        )
        baseline = NociceptorEngine().fire(
            "skin_b", TissueClass.CUTANEOUS, StimulusKind.PRESSURE, 0.5,
        )
        self.assertGreater(inflamed.effective, baseline.effective)

    def test_E_labor_sources_separately_affect(self):
        """E：分娩研究 — 收縮／頸擴張／骨盆受力分別影響訊號。"""
        lab = LaborPainResearch()
        base = lab.evaluate(LaborInputs(
            uterine_contraction=0.0, cervical_dilation_cm=0.0,
            pelvic_floor_load=0.0, perineal_stretch=0.0,
            stage=LaborStage.ACTIVE, individual_sensitivity=1.0,
        ))
        only_con = lab.evaluate(LaborInputs(
            uterine_contraction=0.9, cervical_dilation_cm=0.0,
            pelvic_floor_load=0.0, perineal_stretch=0.0,
            stage=LaborStage.ACTIVE,
        ))
        only_dil = lab.evaluate(LaborInputs(
            uterine_contraction=0.0, cervical_dilation_cm=8.0,
            pelvic_floor_load=0.0, perineal_stretch=0.0,
            stage=LaborStage.ACTIVE,
        ))
        only_pel = lab.evaluate(LaborInputs(
            uterine_contraction=0.0, cervical_dilation_cm=0.0,
            pelvic_floor_load=0.9, perineal_stretch=0.5,
            stage=LaborStage.SECOND,
        ))
        self.assertGreater(only_con.visceral_from_contraction, base.visceral_from_contraction)
        self.assertGreater(only_dil.visceral_from_dilation, base.visceral_from_dilation)
        self.assertGreater(only_pel.somatic_from_pelvic, base.somatic_from_pelvic)
        self.assertGreater(only_con.combined_continuous, base.combined_continuous)
        self.assertGreater(only_dil.combined_continuous, base.combined_continuous)
        self.assertGreater(only_pel.combined_continuous, base.combined_continuous)
        # 不強制懷孕；不假設必達 10
        self.assertFalse(only_con.forces_pregnancy_state)
        mild = lab.evaluate(LaborInputs(
            uterine_contraction=0.3, cervical_dilation_cm=2.0,
            relief_factor=0.6, individual_sensitivity=0.7,
            stage=LaborStage.LATENT,
        ))
        self.assertLess(mild.nrs_estimate, 10.0)

    def test_F_reembody_retains_danger_needs_recalibration(self):
        """F：換虛擬身體 → 保留危險記憶＋重新校準。"""
        core = NociceptionCore(embodiment_id="body-alpha")
        core.sense(
            site="right_hand", stimulus="heat", intensity=0.95,
            object_id="hot_kettle", tissue="cutaneous",
        )
        retained_before = dict(core.danger.object_threat)
        self.assertIn("hot_kettle", retained_before)

        result = core.reembody(
            "body-beta",
            sensor_map={"skin_t_01": "left_palm"},
        )
        self.assertEqual(result["embodiment_id"], "body-beta")
        self.assertTrue(result["needs_recalibration"])
        self.assertFalse(result["calibrated"])
        self.assertIn("hot_kettle", result["danger_retained"])
        self.assertAlmostEqual(
            result["danger_retained"]["hot_kettle"],
            retained_before["hot_kettle"],
            places=5,
        )
        # 新身體部位狀態已清空，需重校；物件危險仍可預測
        pred = core.predict_before_contact(
            "left_palm", "heat", object_id="hot_kettle",
        )
        self.assertGreater(pred["risk"], 0.0)
        self.assertTrue(core.robot.reflex_interface_locked())

    def test_nrs_10_not_coma_or_death(self):
        """額外：NRS 10 不自動等於昏迷／死亡。"""
        scale = PainScaleEngine()
        a = scale.assess(
            sensory=1.0, affective=1.0, tissue_injury=0.5,
            reflex_active=True, consciousness=1.0,
        )
        self.assertGreaterEqual(a.nrs_0_10, 9.0)
        self.assertEqual(a.consciousness, 1.0)
        self.assertIn("不代表死亡", a.note)


if __name__ == "__main__":
    unittest.main()
