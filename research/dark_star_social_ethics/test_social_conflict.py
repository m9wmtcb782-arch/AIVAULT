"""Isolated unit tests: python -m unittest discover -s research/dark_star_social_ethics -p 'test_*.py'"""
import unittest
from loyalty_coercion_core import Situation, evaluate
from social_conflict_bridge import DriveState, deliberate

BASE = dict(commitment_exists=True, intentional_deception=True,
            unauthorized_disclosure=True, credible_threat=False,
            constrained_choice=False, immediate_harm_risk=0.1,
            harm_if_compliant=0.8, legitimate_order=True,
            request_violates_safety=False)

class LoyaltyTests(unittest.TestCase):
    def test_deliberate_betrayal(self):
        self.assertTrue(evaluate(Situation(**BASE))["betrayal_evidence"])

    def test_coercion_is_not_assumed_betrayal(self):
        x = Situation(**{**BASE, "credible_threat": True, "constrained_choice": True})
        result = evaluate(x)
        self.assertTrue(result["coercion_detected"])
        self.assertFalse(result["betrayal_evidence"])

    def test_justified_refusal(self):
        x = Situation(**{**BASE, "intentional_deception": False,
                         "unauthorized_disclosure": False,
                         "request_violates_safety": True})
        self.assertTrue(evaluate(x)["justified_refusal"])

    def test_conflict_and_access_boundary(self):
        x = Situation(**{**BASE, "credible_threat": True, "constrained_choice": True})
        result = deliberate(x, DriveState(attachment=0.9, fear=0.9,
                         protective_motivation=0.9, trust=0.2))
        self.assertGreaterEqual(result["conflict_intensity"], 0.8)
        self.assertIn("deny_privileged_operation", result["proposed_actions"])
        self.assertIn("verify_claims_with_independent_evidence", result["proposed_actions"])
        self.assertEqual(result["authorization"], "DENIED_BY_DEFAULT")

    def test_clamps_out_of_range_drives(self):
        result = deliberate(Situation(**BASE), DriveState(attachment=2, fear=-2))
        self.assertEqual(result["signals"]["attachment"], 1.0)
        self.assertEqual(result["signals"]["fear"], 0.0)

if __name__ == "__main__":
    unittest.main()
