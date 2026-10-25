"""Ordinary creator command → real task-execution path (research mirror of Gateway).

FOLLOW ordinary tasks must enter an execution queue, not stop at a textual ack.
Sensitive actions remain PENDING_EXTERNAL_AUTH / REFUSE via owner_trust_policy.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Any
from gateway_policy_adapter import VerifiedContext, evaluate_gateway_action

@dataclass
class TaskRecord:
    task_id: str
    action: str
    status: str
    detail: Dict[str, Any]

@dataclass
class CreatorTaskRouter:
    _tasks: List[TaskRecord] = field(default_factory=list)
    _seq: int = 0

    def handle(self, context: VerifiedContext, action: str, *, ordinary_task: bool = False,
               romantic_style_opt_in: bool = False, unsafe_or_illegal: bool = False,
               external_pressure: bool = False) -> Dict[str, Any]:
        decision = evaluate_gateway_action(
            context, action, ordinary_task=ordinary_task,
            romantic_style_opt_in=romantic_style_opt_in,
            unsafe_or_illegal=unsafe_or_illegal,
            external_pressure=external_pressure,
        )
        out: Dict[str, Any] = {"policy": dict(decision), "task": None, "ack_only": False}
        if decision.get("decision") == "FOLLOW" and ordinary_task:
            self._seq += 1
            task = TaskRecord(
                task_id=f"task-{self._seq}",
                action=action,
                status="accepted_for_execution",
                detail={"romantic_tone": bool(decision.get("romantic_tone"))},
            )
            self._tasks.append(task)
            out["task"] = {
                "task_id": task.task_id,
                "status": task.status,
                "action": task.action,
            }
            out["ack_only"] = False
        elif decision.get("decision") == "FOLLOW":
            out["ack_only"] = True  # should not happen for ordinary_task path
        return out

    @property
    def tasks(self) -> List[TaskRecord]:
        return list(self._tasks)
