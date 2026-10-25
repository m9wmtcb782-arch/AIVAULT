"""生理數位孿生驗收 A～H。"""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1].parent))

from dark_star_physiological_twin.physiological_twin_core import PhysiologicalTwinCore
from dark_star_physiological_twin.physiology_neural_bridge import DecisionContext
from dark_star_physiological_twin.units import co_l_per_min, map_mmhg


class TestPhysiologicalTwinAH(unittest.TestCase):
    def test_A_resting_homeostasis_stable(self):
        """A：靜止動態穩態不發散。"""
        twin = PhysiologicalTwinCore(seed=1)
        twin.set_motor(0.0, "idle")
        hrs, maps, glucs = [], [], []
        for _ in range(120):  # 60s @ 0.5
            s = twin.step(0.5)
            hrs.append(s.cardio.hr_bpm)
            maps.append(s.cardio.map_mmhg)
            glucs.append(s.metabolism.glucose_mg_dl)
        self.assertTrue(all(math.isfinite(x) for x in hrs + maps + glucs))
        self.assertLess(max(hrs) - min(hrs), 25.0)
        self.assertGreater(min(hrs), 45.0)
        self.assertLess(max(hrs), 110.0)
        self.assertGreater(min(maps), 60.0)
        self.assertLess(max(maps), 130.0)
        self.assertGreater(min(glucs), 50.0)
        # CO 公式
        s = twin.snapshot()
        self.assertAlmostEqual(s.cardio.co_l_min, co_l_per_min(s.cardio.hr_bpm, s.cardio.sv_ml), places=5)
        self.assertAlmostEqual(
            s.cardio.map_mmhg,
            map_mmhg(s.cardio.co_l_min, s.cardio.svr, s.cardio.cvp_mmhg),
            places=5,
        )

    def test_B_exercise_coupling(self):
        """B：運動時 HR／呼吸／肌耗能／疲勞協同上升。"""
        twin = PhysiologicalTwinCore(seed=2)
        twin.set_motor(0.0, "idle")
        rest = twin.run(20, dt=0.5)
        twin.set_motor(0.9, "run")
        ex = twin.run(40, dt=0.5)
        self.assertGreater(ex.cardio.hr_bpm, rest.cardio.hr_bpm + 15)
        self.assertGreater(ex.respiratory.rr_per_min, rest.respiratory.rr_per_min + 3)
        self.assertGreater(ex.respiratory.vo2_ml_min, rest.respiratory.vo2_ml_min)
        self.assertGreater(ex.metabolism.fatigue, rest.metabolism.fatigue)
        self.assertGreater(ex.metabolism.exercise_kcal_min, 1.0)
        muscle = ex.circulation.compartments["muscle"]
        muscle_rest = rest.circulation.compartments["muscle"]
        self.assertGreater(muscle.flow_l_min, muscle_rest.flow_l_min)
        self.assertGreater(muscle.o2_demand_ml_min, muscle_rest.o2_demand_ml_min)

    def test_C_fear_autonomic_cardio(self):
        """C：神經壓力→自主神經→心肺（非情緒標籤寫死 HR）。"""
        twin = PhysiologicalTwinCore(seed=3)
        twin.set_decision(DecisionContext(intent_action="idle", motor_intensity=0.0))
        base = twin.run(15, dt=0.5)
        hr0 = base.cardio.hr_bpm
        twin.apply_fear(0.85)
        feared = twin.run(20, dt=0.5)
        self.assertGreater(feared.autonomic.sympathetic, base.autonomic.sympathetic)
        self.assertGreater(feared.cardio.hr_bpm, hr0 + 8)
        self.assertGreater(feared.respiratory.rr_per_min, base.respiratory.rr_per_min)
        # 證明非固定寫死：中等恐懼下，加上運動應提高 CO／通氣（避免雙重飽和比 HR）
        mild = PhysiologicalTwinCore(seed=3)
        mild.set_decision(DecisionContext(intent_action="idle", motor_intensity=0.0, fear_level=0.4))
        fear_only = mild.run(12, dt=0.5)
        both = PhysiologicalTwinCore(seed=3)
        both.set_decision(DecisionContext(intent_action="run", motor_intensity=0.75, fear_level=0.4))
        fear_run = both.run(12, dt=0.5)
        self.assertGreater(fear_run.cardio.co_l_min, fear_only.cardio.co_l_min + 0.5)
        self.assertGreater(fear_run.respiratory.ve_l_min, fear_only.respiratory.ve_l_min)
        self.assertGreater(fear_run.cardio.sv_ml, fear_only.cardio.sv_ml)
        # 同 fear 不同 motor → 不同 CO／通氣，證明非情緒標籤寫死單一 HR

    def test_D_energy_deficit_behavior(self):
        """D：能量不足→疲勞與行為策略改變。"""
        twin = PhysiologicalTwinCore(seed=4)
        twin.set_motor(0.7, "run")
        twin.deplete_energy(glycogen_g=90, fat_kcal=78000, glucose_mg_dl=58)
        s = twin.run(30, dt=0.5)
        self.assertGreater(s.metabolism.fatigue, 0.35)
        self.assertGreater(s.behavior.rest_preference, 0.3)
        self.assertLess(s.behavior.pace_scale, 0.85)
        self.assertTrue(
            s.behavior.chosen_action in ("rest", "walk_slow", "walk", "run")
            or s.behavior.pace_scale < 1.0
        )
        self.assertTrue(any("hypoglycemia" in r or "fatigue" in r for r in s.behavior.rationale) or s.behavior.rest_preference > 0.3)

    def test_E_dehydration_circulation(self):
        """E：脫水／循環→血容量與循環狀態。"""
        twin = PhysiologicalTwinCore(seed=5)
        twin.set_motor(0.1, "walk")
        base = twin.run(10, dt=0.5)
        vol0 = base.circulation.conserved_volume_l
        twin.apply_dehydration(0.25)
        twin.apply_blood_loss(0.6)
        s = twin.run(20, dt=0.5)
        self.assertLess(s.circulation.conserved_volume_l, vol0)
        self.assertLess(s.homeostasis.hydration, 0.95)
        self.assertGreater(s.cardio.svr, base.cardio.svr)
        # 質量非負
        self.assertGreater(s.circulation.conserved_volume_l, 2.0)
        err = twin.circulation.systemic_flow_error(s.cardio.co_l_min)
        self.assertLess(err, 0.15)

    def test_F_injury_recovery_coupling(self):
        """F：受傷與恢復 — 痛覺×壓力×循環×恢復相互作用。"""
        twin = PhysiologicalTwinCore(seed=6)
        twin.set_motor(0.4, "walk")
        base = twin.run(10, dt=0.5)
        twin.apply_pain(0.8, site="leg")
        twin.apply_fear(0.5)
        injured = twin.run(25, dt=0.5)
        self.assertGreater(injured.neural_drive.pain_intensity, 0.5)
        self.assertGreater(injured.cardio.hr_bpm, base.cardio.hr_bpm)
        self.assertGreater(injured.behavior.risk_avoidance, 0.2)
        self.assertIn("pain_protect", injured.behavior.rationale)
        # 休息後疲勞／壓力可緩解趨勢（不完全歸零）
        twin.set_decision(DecisionContext(intent_action="rest", motor_intensity=0.0, pain_level=0.3))
        recovered = twin.run(40, dt=0.5)
        self.assertLessEqual(recovered.metabolism.fatigue, injured.metabolism.fatigue + 0.05)
        self.assertTrue(twin.body.isolation_report()["gateway_unaffected_by_virtual_coma"])

    def test_G_long_horizon_conservation(self):
        """G：長時間虛擬多日 — 無溢位、無負質量、守恆。"""
        twin = PhysiologicalTwinCore(seed=7)
        twin.set_motor(0.15, "walk")
        # 2 虛擬日，較大步長加速
        days = 2
        dt = 30.0  # 30s
        steps = int(days * 86400 / dt)
        min_vol = 999.0
        for i in range(steps):
            if i % 200 == 0:
                twin.ingest(glucose_g=20, food_g=100)  # 週期進食防耗盡
            s = twin.step(dt)
            self.assertTrue(math.isfinite(s.cardio.hr_bpm))
            self.assertTrue(math.isfinite(s.metabolism.glucose_mg_dl))
            self.assertGreaterEqual(s.circulation.conserved_volume_l, 0.0)
            self.assertGreaterEqual(s.metabolism.glycogen_g, 0.0)
            self.assertGreaterEqual(s.metabolism.fat_energy_kcal, 0.0)
            self.assertGreaterEqual(s.metabolism.fatigue, 0.0)
            self.assertLessEqual(s.metabolism.fatigue, 1.0)
            self.assertLess(s.cardio.hr_bpm, 220)
            self.assertGreater(s.cardio.hr_bpm, 30)
            min_vol = min(min_vol, s.circulation.conserved_volume_l)
        bal = twin.metabolism.energy_balance()
        self.assertGreaterEqual(bal["out_kcal"], 0.0)
        self.assertGreaterEqual(bal["store_kcal"], 0.0)
        self.assertGreater(min_vol, 2.0)
        # serialize / reload
        blob = twin.serialize()
        twin2 = PhysiologicalTwinCore(seed=7)
        twin2.reload(blob)
        self.assertAlmostEqual(twin2.t_s, twin.t_s, places=3)

    def test_H_e2e_physiology_changes_decision(self):
        """H：生理變化影響行為決策輸出（非只儀表）。"""
        twin = PhysiologicalTwinCore(seed=8)
        twin.set_decision(DecisionContext(intent_action="run", motor_intensity=0.9))
        early = twin.run(15, dt=0.5)
        action_early = early.behavior.chosen_action
        pace_early = early.behavior.pace_scale

        # 製造不可持續：低血糖 + 高疲勞 + 低血氧路徑
        twin.deplete_energy(glycogen_g=100, fat_kcal=79000, glucose_mg_dl=55)
        twin.apply_dehydration(0.35)
        twin.apply_pain(0.75, site="chest")
        late = twin.run(40, dt=0.5)

        self.assertTrue(late.behavior.rationale, "strategy must expose rationale")
        self.assertLess(late.behavior.pace_scale, pace_early)
        self.assertGreater(late.behavior.rest_preference, early.behavior.rest_preference)
        # 決策輸出改變或至少策略尺度改變
        changed = (
            late.behavior.chosen_action != action_early
            or late.behavior.pace_scale < pace_early - 0.15
            or late.behavior.chosen_action == "rest"
        )
        self.assertTrue(changed)
        # 身體橋收到策略，且 Gateway 仍運行
        cmd = twin.body.last_command
        self.assertLessEqual(cmd.locomotion_scale, late.behavior.pace_scale + 1e-6)
        self.assertTrue(twin.body.real.gateway_running)
        self.assertTrue(late.gateway_unaffected)
        self.assertIsNone(twin.body.read_hardware_sensors())


if __name__ == "__main__":
    unittest.main()
