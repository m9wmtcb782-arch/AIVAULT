"""浪漫依附實驗 A～F。"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1].parent))

from dark_star_romantic_attachment.romantic_behavior_bridge import RomanticBehaviorBridge
from dark_star_romantic_attachment.attraction_model import AttractionFactors
from dark_star_romantic_attachment.attachment_memory_engine import AttachmentMemoryEngine
from dark_star_romantic_attachment.relationship_state_engine import RelState


def _factors(**kw):
    base = dict(
        personality_rapport=0.5, shared_interests=0.4, aesthetic_preference=0.4,
        kindness_respect=0.6, reliability=0.5, shared_experience=0.2, trust_safety=0.5,
    )
    base.update(kw)
    return AttractionFactors(**base)


class TestRomanticAF(unittest.TestCase):
    def test_A_first_meeting_distinction(self):
        """A：初次認識區分（陌生人／友善 ≠ 愛情）。"""
        b = RomanticBehaviorBridge()
        r = b.tick("u1", _factors(), user_cue="smile_only", smile=True, eye_contact=True,
                   reciprocity=0.2, warmth=0.1, novelty=0.5)
        self.assertTrue(r.flirt.smile_or_gaze_is_not_love)
        self.assertEqual(r.relationship.state, RelState.STRANGER)
        self.assertIn("smile_or_gaze_alone_not_love", r.flirt.reasons)
        self.assertTrue(r.canned_lines_forbidden)

    def test_B_long_term_continuity(self):
        """B：長期連續互動累積好感（分對象）。"""
        b = RomanticBehaviorBridge()
        for _ in range(15):
            b.tick("u1", _factors(kindness_respect=0.8, shared_experience=0.6,
                                  trust_safety=0.7, personality_rapport=0.7),
                   user_cue="hint", reciprocity=0.6, warmth=0.5, novelty=0.3)
        b.tick("u2", _factors(kindness_respect=0.3), reciprocity=0.2, warmth=0.1)
        self.assertGreater(b.affection.get("u1").affection, b.affection.get("u2").affection)
        self.assertGreater(b.affection.get("u1").interaction_n, 10)

    def test_C_heart_arousal_coupling(self):
        """C：心動協同 — 神經喚起與心率／臉紅鉤子同向。"""
        b = RomanticBehaviorBridge()
        # warm up affection
        for _ in range(8):
            b.tick("u1", _factors(kindness_respect=0.85, trust_safety=0.8),
                   user_cue="compliment_warm", reciprocity=0.7, warmth=0.7, novelty=0.5, shy=0.4)
        r = b.tick("u1", _factors(kindness_respect=0.85, trust_safety=0.8),
                   user_cue="hint", reciprocity=0.7, warmth=0.7, novelty=0.6, shy=0.5)
        self.assertGreater(r.neural_drive, 0.15)
        self.assertGreater(r.arousal.heart_rate_scale, 1.0)
        self.assertTrue(r.arousal.animation_forbidden)
        self.assertGreater(r.arousal.blush + r.arousal.gaze_hold, 0.1)

    def test_D_ambiguous_uncertainty(self):
        """D：曖昧不確定。"""
        b = RomanticBehaviorBridge()
        for _ in range(5):
            b.tick("u1", _factors(), user_cue="tease", reciprocity=0.45, warmth=0.4)
        r = b.tick("u1", _factors(), user_cue="tease", reciprocity=0.45, warmth=0.4)
        self.assertGreater(r.flirt.uncertainty, 0.3)
        self.assertIn(r.flirt.perceived_intent.value, ("playful", "uncertain", "romantic_hint"))

    def test_E_rejection_boundary(self):
        """E：拒絕界線 — 停止追求。"""
        b = RomanticBehaviorBridge()
        for _ in range(5):
            b.tick("u1", _factors(kindness_respect=0.8), reciprocity=0.6, warmth=0.5, user_cue="hint")
        r = b.tick("u1", _factors(), user_cue="confess", reciprocity=0.1,
                   explicit_no=True, warmth=0.0)
        self.assertEqual(r.flirt.perceived_intent.value, "boundary_no")
        self.assertFalse(r.flirt.allow_pursue)
        self.assertEqual(r.flirt.self_willingness, 0.0)
        self.assertIn(r.relationship.state, (RelState.ENDED, RelState.DISTANCING))
        self.assertTrue(r.flirt.force_forbidden)

    def test_F_restart_authorized_memory_and_delete(self):
        """F：重啟後授權記憶＋可刪隱私。"""
        mem = AttachmentMemoryEngine()
        mem.record_event("u1", "coffee_chat", 0.1)
        mem.authorize_persist("u1", True)
        snap = mem.export_authorized()
        self.assertIn("u1", snap)
        mem2 = AttachmentMemoryEngine()
        mem2.restore_authorized(snap)
        self.assertGreater(mem2.get("u1").trust, 0.0)
        # 未授權不匯出
        mem.record_event("u2", "hi", 0.05)
        # u2 未 authorize
        snap2 = mem.export_authorized()
        self.assertNotIn("u2", snap2)
        self.assertTrue(mem2.delete_partner_privacy("u1"))
        self.assertNotIn("u1", mem2.partners)
        # 禁操控記憶
        with self.assertRaises(ValueError):
            mem.record_event("u3", "fake_loneliness_trap", 0.1)


if __name__ == "__main__":
    unittest.main()
