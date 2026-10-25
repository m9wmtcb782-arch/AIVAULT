"""器官功能狀態總表｜獨立狀態 + 共享核心相互作用。"""
from __future__ import annotations

from typing import Dict

from .state import OrganState
from .units import clamp01


class VirtualOrganStateEngine:
    def __init__(self) -> None:
        self.organs: Dict[str, OrganState] = {
            "gi": OrganState("gi"),
            "liver": OrganState("liver"),
            "pancreas": OrganState("pancreas"),
            "kidney": OrganState("kidney"),
            "lung": OrganState("lung"),
            "heart": OrganState("heart"),
            "muscle": OrganState("muscle"),
            "skin": OrganState("skin"),
            "brain": OrganState("brain"),
        }

    def update(
        self,
        *,
        gi_fn: float,
        liver_fn: float,
        kidney_fn: float,
        lung_spo2: float,
        heart_co_norm: float,
        muscle_load: float,
        muscle_fatigue: float,
        skin_flow_scale: float,
        brain_perf: float,
        glucose: float,
        pain: float,
    ) -> Dict[str, OrganState]:
        o = self.organs
        o["gi"].function = clamp01(gi_fn)
        o["liver"].function = clamp01(liver_fn)
        o["pancreas"].function = clamp01(0.9 + 0.1 * (1.0 if 70 <= glucose <= 140 else 0.7))
        o["kidney"].function = clamp01(kidney_fn)
        o["lung"].function = clamp01(lung_spo2)
        o["heart"].function = clamp01(heart_co_norm)
        o["muscle"].function = clamp01(1.0 - 0.5 * muscle_fatigue)
        o["muscle"].load = clamp01(muscle_load)
        o["skin"].function = clamp01(0.8 + 0.2 * min(skin_flow_scale, 1.5) / 1.5)
        o["brain"].function = clamp01(brain_perf * (1.0 - 0.3 * pain))
        o["brain"].load = clamp01(pain)
        return o
