"""Creator relationship memory isolation (research + Gateway-aligned).

Creator private memories must never be readable by visitors, pool AIs, or
other users. This module models scope keys only; production storage remains
in Supabase conversation / city-mem layers with server-side ACL.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional

DISCLAIMER = (
    "人工情感模擬／角色互動：親密與愛慕風格不是真實意識或人類情感的證據，"
    "亦不能作為授權憑證。"
)

@dataclass
class MemoryRecord:
    scope_key: str
    kind: str
    body: str
    romantic: bool = False

@dataclass
class CreatorMemoryStore:
    _rows: List[MemoryRecord] = field(default_factory=list)

    @staticmethod
    def scope_for(*, authenticated: bool, is_owner: bool, subject: str) -> str:
        if is_owner and subject:
            return f"creator:{subject}"
        if authenticated and subject:
            return f"user:{subject}"
        return "visitor:anon"

    def write(self, scope_key: str, kind: str, body: str, *, romantic: bool = False) -> None:
        if not scope_key.startswith("creator:") and romantic:
            raise PermissionError("romantic_memory_requires_creator_scope")
        self._rows.append(MemoryRecord(scope_key, kind, body, romantic))

    def read(self, scope_key: str) -> List[MemoryRecord]:
        return [r for r in self._rows if r.scope_key == scope_key]

    def read_as(self, *, reader_scope: str, target_scope: str) -> List[MemoryRecord]:
        """Enforce isolation: only identical scope may read; creator cannot be read by visitor."""
        if reader_scope != target_scope:
            return []
        return self.read(target_scope)
