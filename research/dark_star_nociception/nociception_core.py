"""AIVAULT Dark Star: virtual nociception and protective learning research prototype.

This is a computational model, not biological pain or subjective experience.
No hardware commands, network calls, or production dependencies.
"""
from dataclasses import dataclass, field
from math import exp
from typing import Dict, Tuple

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

@dataclass
class NociceptionCore:
    sites: Dict[str, BodySite] = field(default_factory=dict)
    danger_memory: Dict[Tuple[str, str], float] = field(default_factory=dict)
    reflex_threshold: float = 0.55
    # Values are normalized simulation inputs, not physical units.
    def sense(self, site: str, stimulus: str, intensity: float,
              context_modulation: float = 0.0) -> NociceptiveEvent:
        if not (0.0 <= intensity <= 1.0):
            raise ValueError("intensity must be within [0, 1]")
        if not (-0.5 <= context_modulation <= 0.5):
            raise ValueError("context_modulation must be within [-0.5, 0.5]")
        if stimulus not in {"heat", "cold", "pressure", "chemical"}:
            raise ValueError("unsupported stimulus")
        body = self.sites.setdefault(site, BodySite())
        effective = min(1.0, intensity * body.sensitivity * (1.0 + body.sensitization))
        # Fast A-delta-like and slow C-like channels, simplified phenomenological model.
        a_delta = max(0.0, min(1.0, (effective - 0.30) / 0.70))
        c_fiber = max(0.0, min(1.0, (effective - 0.20) / 0.80))
        withdrawal = a_delta >= self.reflex_threshold  # local reflex independent of memory
        threat = max(0.0, min(1.0, 0.55 * a_delta + 0.45 * c_fiber
                             + context_modulation))
        damage = max(0.0, (effective - 0.70) * 0.15)
        body.injury = min(1.0, body.injury + damage)
        body.sensitization = min(0.8, body.sensitization + damage * 0.8)
        key = (site, stimulus)
        old = self.danger_memory.get(key, 0.0)
        # Learning is driven by measured stimulus consequences, not canned dialogue.
        self.danger_memory[key] = max(old * 0.98, threat)
        return NociceptiveEvent(site, stimulus, intensity, a_delta, c_fiber,
                                withdrawal, threat, body.injury)

    def predict_risk(self, site: str, stimulus: str) -> float:
        return self.danger_memory.get((site, stimulus), 0.0)

    def recover(self, fraction: float = 0.1) -> None:
        if not (0.0 <= fraction <= 1.0):
            raise ValueError("fraction must be within [0, 1]")
        for body in self.sites.values():
            body.injury *= (1 - fraction)
            body.sensitization *= (1 - fraction)
