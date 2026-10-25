"""虛實神經介面 stub：感測輸入、部位、編碼、反射、危險記憶共享、換身校準、實體安全層。

現階段僅虛擬；實體技能預設 locked，不直接控制硬體。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class SensorReading:
    sensor_id: str
    modality: str          # pressure | temperature | damage | contact
    body_site: str
    value: float
    timestamp: float
    source: str = "virtual"  # virtual | hardware


@dataclass
class EncodedNeuralPacket:
    site: str
    intensity: float
    modality: str
    encoding: str = "normalized_0_1"
    evidence_tier: str = "approximation"


@dataclass
class EmbodimentCalibration:
    embodiment_id: str
    sensor_map: Dict[str, str] = field(default_factory=dict)  # sensor_id -> site
    actuator_limits: Dict[str, float] = field(default_factory=dict)
    calibrated: bool = False
    pending_research: List[str] = field(default_factory=lambda: [
        "hardware_driver",
        "real_tactile_skin",
        "independent_robot_estop",
        "clinical_threshold_calibration",
    ])


class RobotSensoryAdapter:
    """虛實介面；實體輸出預設鎖定。"""

    def __init__(self, embodiment_id: str = "virtual-default") -> None:
        self.embodiment_id = embodiment_id
        self.hardware_enabled: bool = False  # 永遠需顯式安全解鎖
        self.calibration = EmbodimentCalibration(embodiment_id=embodiment_id)
        self.shared_danger: Dict[str, float] = {}

    def encode_sensor(self, reading: SensorReading) -> EncodedNeuralPacket:
        site = self.calibration.sensor_map.get(reading.sensor_id, reading.body_site)
        return EncodedNeuralPacket(
            site=site,
            intensity=max(0.0, min(1.0, reading.value)),
            modality=reading.modality,
        )

    def share_danger_memory(self, object_threat: Dict[str, float]) -> None:
        for k, v in object_threat.items():
            self.shared_danger[k] = max(self.shared_danger.get(k, 0.0), v)

    def get_shared_danger(self) -> Dict[str, float]:
        return dict(self.shared_danger)

    def begin_embodiment_recalibration(self, new_id: str, sensor_map: Dict[str, str]) -> EmbodimentCalibration:
        """換身：保留共享危險記憶，感測／運動能力需重新校準。"""
        retained = dict(self.shared_danger)
        self.embodiment_id = new_id
        self.calibration = EmbodimentCalibration(
            embodiment_id=new_id,
            sensor_map=dict(sensor_map),
            calibrated=False,
        )
        self.shared_danger = retained
        self.hardware_enabled = False
        return self.calibration

    def mark_calibrated(self, actuator_limits: Optional[Dict[str, float]] = None) -> None:
        self.calibration.calibrated = True
        if actuator_limits:
            self.calibration.actuator_limits = dict(actuator_limits)

    def reflex_interface_locked(self) -> bool:
        """實體反射控制層：未解鎖則不可下發硬體。"""
        return not self.hardware_enabled

    def request_hardware_enable(self) -> dict:
        return {
            "enabled": False,
            "reason": "實體控制預設鎖定；需獨立安全層與明確授權後才能啟用。",
            "pending_research": list(self.calibration.pending_research),
        }
