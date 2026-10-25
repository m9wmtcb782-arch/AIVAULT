"""與動作／姿態／表達介面；虛實隔離。

虛擬生理狀態 ≠ 伺服器／GPU／Gateway 健康。
虛擬昏迷不得停止 AI Gateway。
實體機器人須另建硬體感測介面，不得把虛擬血壓／疼痛當真實感測。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .state import BehaviorStrategy, TwinSnapshot
from .units import clamp01


@dataclass
class RealSystemHealth:
    """真實運算資源（與虛擬身體隔離）。"""
    cpu_ok: bool = True
    gpu_ok: bool = True
    memory_ok: bool = True
    network_ok: bool = True
    gateway_running: bool = True


@dataclass
class HardwareSensorInterface:
    """未來實體機器人感測 stub｜預設關閉。"""
    hardware_enabled: bool = False
    notes: str = "虛擬血壓／疼痛不得直接當作真實硬體感測結果"


@dataclass
class BodyCommand:
    posture_bias: str = "neutral"
    locomotion_scale: float = 1.0
    expression_arousal: float = 0.2
    breathe_vis_scale: float = 1.0
    virtual_consciousness: float = 1.0


class PhysiologyBodyBridge:
    def __init__(self) -> None:
        self.real = RealSystemHealth()
        self.hardware = HardwareSensorInterface()
        self.last_command = BodyCommand()

    def map_snapshot(self, snap: TwinSnapshot, strategy: BehaviorStrategy) -> BodyCommand:
        fatigue = snap.metabolism.fatigue
        spo2 = snap.respiratory.spo2
        map_ = snap.cardio.map_mmhg
        # 虛擬意識代理（不影響 Gateway）
        v_conscious = clamp01(
            0.5 * (spo2 - 0.75) / 0.25
            + 0.3 * clamp01(map_ / 70.0)
            + 0.2 * (1.0 - fatigue)
        )
        if snap.homeostasis.mode == "sustained_imbalance" and spo2 < 0.85:
            posture = "collapse_virtual"
        elif strategy.rest_preference > 0.6:
            posture = "rest"
        elif strategy.pace_scale < 0.5:
            posture = "slow"
        else:
            posture = "active"

        cmd = BodyCommand(
            posture_bias=posture,
            locomotion_scale=strategy.pace_scale,
            expression_arousal=clamp01(snap.autonomic.sympathetic),
            breathe_vis_scale=clamp01(snap.respiratory.rr_per_min / 20.0),
            virtual_consciousness=v_conscious,
        )
        self.last_command = cmd
        # 硬隔離：無論虛擬昏迷，Gateway 標誌保持
        assert self.real.gateway_running, "invariant: gateway must stay up"
        return cmd

    def isolation_report(self) -> Dict[str, Any]:
        return {
            "virtual_only": True,
            "gateway_unaffected_by_virtual_coma": True,
            "hardware_enabled": self.hardware.hardware_enabled,
            "hardware_note": self.hardware.notes,
            "real_system": {
                "cpu_ok": self.real.cpu_ok,
                "gpu_ok": self.real.gpu_ok,
                "gateway_running": self.real.gateway_running,
            },
        }

    def read_hardware_sensors(self) -> Optional[dict]:
        if not self.hardware.hardware_enabled:
            return None
        raise RuntimeError("hardware path not implemented; refuse virtual→real sensor spoofing")
