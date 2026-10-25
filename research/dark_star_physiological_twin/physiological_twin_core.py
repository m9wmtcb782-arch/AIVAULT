"""Dark Star Physiological Digital Twin｜頂層 orchestrator。

統一時間步進、pause/resume、serialize/reload、可重現種子。
虛實隔離：虛擬生理不影響 Gateway／真實運算健康。

虛擬模擬 ≠ 主觀意識／真實生物感受。
未通過驗收不得宣稱完整人體生理系統。
"""
from __future__ import annotations

import json
from copy import deepcopy
from typing import Optional

from .physiology_body_bridge import PhysiologyBodyBridge
from .physiology_neural_bridge import DecisionContext, PhysiologyNeuralBridge
from .state import AutonomicTone, BehaviorStrategy, NeuralDrive, TwinSnapshot
from .units import clamp01
from .virtual_cardiovascular_engine import VirtualCardiovascularEngine
from .virtual_circulation_engine import VirtualCirculationEngine
from .virtual_digestive_engine import VirtualDigestiveEngine
from .virtual_endocrine_engine import VirtualEndocrineEngine
from .virtual_homeostasis_engine import VirtualHomeostasisEngine
from .virtual_liver_engine import VirtualLiverEngine
from .virtual_metabolism_engine import VirtualMetabolismEngine
from .virtual_organ_state_engine import VirtualOrganStateEngine
from .virtual_renal_engine import VirtualRenalEngine
from .virtual_respiratory_engine import VirtualRespiratoryEngine
from .virtual_thermoregulation_engine import VirtualThermoregulationEngine


class PhysiologicalTwinCore:
    def __init__(self, seed: int = 0) -> None:
        self.seed = seed
        self.t_s = 0.0
        self.paused = False
        self.autonomic = AutonomicTone()
        self.drive = NeuralDrive()

        self.cardio = VirtualCardiovascularEngine(seed=seed)
        self.circulation = VirtualCirculationEngine()
        self.respiratory = VirtualRespiratoryEngine()
        self.metabolism = VirtualMetabolismEngine()
        self.digestive = VirtualDigestiveEngine()
        self.liver = VirtualLiverEngine()
        self.renal = VirtualRenalEngine()
        self.endocrine = VirtualEndocrineEngine()
        self.thermo = VirtualThermoregulationEngine()
        self.homeostasis = VirtualHomeostasisEngine()
        self.organs = VirtualOrganStateEngine()
        self.neural = PhysiologyNeuralBridge()
        self.body = PhysiologyBodyBridge()
        self._last_behavior: BehaviorStrategy = BehaviorStrategy()
        self._last_ctx = DecisionContext()

    def pause(self) -> None:
        self.paused = True

    def resume(self) -> None:
        self.paused = False

    def set_decision(self, ctx: DecisionContext) -> None:
        self._last_ctx = ctx
        self.drive = self.neural.drive_from_decision(ctx)

    def set_motor(self, intensity: float, action: str = "run") -> None:
        self.set_decision(
            DecisionContext(intent_action=action, motor_intensity=clamp01(intensity))
        )

    def apply_fear(self, level: float) -> None:
        self._last_ctx.fear_level = clamp01(level)
        self.drive = self.neural.drive_from_decision(self._last_ctx)

    def apply_pain(self, level: float, site: str = "limb") -> None:
        linked = self.neural.apply_injury_stimulus(site, clamp01(level))
        self._last_ctx.pain_level = max(clamp01(level), linked)
        self._last_ctx.labels["injury"] = max(
            self._last_ctx.labels.get("injury", 0.0), clamp01(level) * 0.8
        )
        self.drive = self.neural.drive_from_decision(self._last_ctx)

    def apply_dehydration(self, deficit: float) -> None:
        self.circulation.apply_dehydration(deficit)

    def apply_blood_loss(self, liters: float) -> None:
        self.circulation.apply_blood_loss(liters)

    def deplete_energy(self, glycogen_g: float = 0.0, fat_kcal: float = 0.0, glucose_mg_dl: Optional[float] = None) -> None:
        if glycogen_g:
            self.metabolism.state.glycogen_g = max(0.0, self.metabolism.state.glycogen_g - glycogen_g)
        if fat_kcal:
            self.metabolism.state.fat_energy_kcal = max(0.0, self.metabolism.state.fat_energy_kcal - fat_kcal)
        if glucose_mg_dl is not None:
            self.metabolism.state.glucose_mg_dl = glucose_mg_dl
        self.metabolism.state.energy_reserve_kcal = (
            self.metabolism.state.glycogen_g * 4.0 + self.metabolism.state.fat_energy_kcal
        )

    def ingest(self, glucose_g: float = 0.0, food_g: float = 0.0) -> None:
        self.digestive.eat(food_g)
        self.metabolism.ingest(glucose_g=glucose_g)

    def _build_snapshot(self, behavior: BehaviorStrategy) -> TwinSnapshot:
        return TwinSnapshot(
            t_s=self.t_s,
            cardio=deepcopy(self.cardio.state),
            circulation=deepcopy(self.circulation.state),
            respiratory=deepcopy(self.respiratory.state),
            metabolism=deepcopy(self.metabolism.state),
            homeostasis=deepcopy(self.homeostasis.state),
            organs=deepcopy(dict(self.organs.organs)),
            autonomic=deepcopy(self.autonomic),
            neural_drive=deepcopy(self.drive),
            behavior=deepcopy(behavior),
            paused=self.paused,
            seed=self.seed,
            virtual_only=True,
            gateway_unaffected=self.body.real.gateway_running,
        )

    def snapshot(self) -> TwinSnapshot:
        return self._build_snapshot(self._last_behavior)

    def step(self, dt: float) -> TwinSnapshot:
        if self.paused or dt <= 0:
            return self.snapshot()

        self.metabolism.step(dt, self.drive, self.thermo.state.core_temp_c)
        vo2 = self.metabolism.vo2_demand_ml_min()

        dig = self.digestive.step(dt, self.metabolism.state.hunger)
        if dig.absorption_rate_g_s > 0:
            self.metabolism.ingest(glucose_g=dig.absorption_rate_g_s * dt * 0.5)

        hydration = clamp01(
            self.circulation.blood_volume_l / self.circulation.params.blood_volume_rest_l
        )
        self.cardio.step(
            dt,
            self.autonomic,
            self.drive,
            hydration=hydration,
            fatigue=self.metabolism.state.fatigue,
            blood_volume_l=self.circulation.blood_volume_l,
        )

        circ = self.circulation.step(
            dt,
            self.cardio.state.co_l_min,
            self.drive,
            spo2=self.respiratory.state.spo2,
        )
        self.circulation.recover_volume(dt)

        muscle = circ.compartments.get("muscle")
        o2_ok = 1.0
        if muscle and muscle.o2_demand_ml_min > 0:
            o2_ok = clamp01(muscle.o2_supply_ml_min / max(muscle.o2_demand_ml_min, 1.0))
        self.respiratory.step(
            dt,
            metabolic_vo2=vo2,
            co_l_min=self.cardio.state.co_l_min,
            autonomic=self.autonomic,
            drive=self.drive,
            circulation_o2_ok=o2_ok,
        )

        kidney_flow = circ.compartments["kidney"].flow_l_min if "kidney" in circ.compartments else 1.0
        self.renal.step(dt, hydration, self.cardio.state.map_mmhg, kidney_flow)
        self.liver.step(
            dt,
            self.metabolism.state.glycogen_g,
            self.metabolism.state.glucagon_au,
            self.metabolism.state.insulin_au,
        )
        self.endocrine.step(
            dt,
            self.metabolism.state.glucose_mg_dl,
            self.drive,
            self.metabolism.state.insulin_au,
            self.metabolism.state.glucagon_au,
        )
        skin_flow = circ.compartments["skin"].flow_l_min if "skin" in circ.compartments else 0.4
        self.thermo.step(
            dt,
            self.metabolism.state.heat_production_w,
            skin_flow,
            motor=self.drive.motor_intensity,
        )

        energy_norm = clamp01(self.metabolism.state.energy_reserve_kcal / 80100.0)
        external_stress = clamp01(
            self.drive.fear_autonomic
            + 0.5 * self.drive.pain_intensity
            + 0.3 * self.drive.motor_intensity
        )
        self.homeostasis.step(
            dt,
            core_temp_c=self.thermo.state.core_temp_c,
            glucose_mg_dl=self.metabolism.state.glucose_mg_dl,
            map_mmhg=self.cardio.state.map_mmhg,
            spo2=self.respiratory.state.spo2,
            hydration=hydration,
            na_mmol_l=self.renal.state.na_mmol_l,
            k_mmol_l=self.renal.state.k_mmol_l,
            energy_reserve_norm=energy_norm,
            fatigue=self.metabolism.state.fatigue,
            external_stress=external_stress,
        )

        fb = self.homeostasis.feedback_adjustments()
        self.autonomic.sympathetic = clamp01(
            self.autonomic.sympathetic + 0.05 * fb["cardio_support"] - 0.03 * fb["rest_drive"]
        )
        self.autonomic.parasympathetic = clamp01(
            self.autonomic.parasympathetic + 0.04 * fb["rest_drive"] - 0.03 * external_stress
        )

        brain_flow = circ.compartments["brain"].flow_l_min if "brain" in circ.compartments else 0.7
        self.organs.update(
            gi_fn=self.digestive.state.function,
            liver_fn=self.liver.state.function,
            kidney_fn=self.renal.state.function,
            lung_spo2=self.respiratory.state.spo2,
            heart_co_norm=clamp01(self.cardio.state.co_l_min / 5.0),
            muscle_load=self.drive.motor_intensity,
            muscle_fatigue=self.metabolism.state.fatigue,
            skin_flow_scale=self.thermo.state.skin_blood_flow_scale,
            brain_perf=clamp01(brain_flow / 0.7),
            glucose=self.metabolism.state.glucose_mg_dl,
            pain=self.drive.pain_intensity,
        )

        provisional = self._build_snapshot(self._last_behavior)
        self._last_behavior = self.neural.strategy_from_physiology(provisional, self._last_ctx)
        snap = self._build_snapshot(self._last_behavior)
        self.body.map_snapshot(snap, self._last_behavior)

        self.t_s += dt
        return snap

    def serialize(self) -> str:
        snap = self.snapshot()
        payload = {
            "t_s": self.t_s,
            "paused": self.paused,
            "seed": self.seed,
            "snapshot": snap.to_dict(),
            "bleed_l": self.circulation._bleed_l,
            "water_deficit": self.circulation._water_deficit,
            "memory_events": list(self.neural.memory.events),
            "isolation": self.body.isolation_report(),
        }
        return json.dumps(payload)

    def reload(self, data: str | dict) -> None:
        payload = json.loads(data) if isinstance(data, str) else data
        self.t_s = float(payload.get("t_s", 0.0))
        self.paused = bool(payload.get("paused", False))
        self.seed = int(payload.get("seed", 0))
        self.circulation._bleed_l = float(payload.get("bleed_l", 0.0))
        self.circulation._water_deficit = float(payload.get("water_deficit", 0.0))
        self.neural.memory.events = list(payload.get("memory_events", []))
        snap = payload.get("snapshot") or {}
        for eng_name, eng in (
            ("cardio", self.cardio.state),
            ("metabolism", self.metabolism.state),
            ("respiratory", self.respiratory.state),
            ("homeostasis", self.homeostasis.state),
        ):
            block = snap.get(eng_name) or {}
            for k, v in block.items():
                if hasattr(eng, k):
                    setattr(eng, k, v)

    def run(self, seconds: float, dt: float = 0.5) -> TwinSnapshot:
        n = max(1, int(seconds / dt))
        for _ in range(n):
            self.step(dt)
        return self.snapshot()
