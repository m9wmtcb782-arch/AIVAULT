"""Tests for owner trust policy (research-only)."""
import unittest
from owner_trust_policy import Request, check_request, SENSITIVE_ACTIONS

class OwnerTrustTests(unittest.TestCase):
    def test_all_sensitive_actions_require_identity(self):
        for action in SENSITIVE_ACTIONS:
            with self.subTest(action=action):
                self.assertFalse(check_request(Request(action)).allowed)

    def test_owner_requires_explicit_approval(self):
        self.assertFalse(check_request(Request("delete_database", True, True, False)).allowed)

    def test_verified_owner_can_only_be_eligible_for_external_gate(self):
        d = check_request(Request("deploy_production", True, True, True))
        self.assertTrue(d.allowed)
        self.assertTrue(d.requires_independent_enforcement)

    def test_coercion_blocks_even_verified_owner(self):
        self.assertFalse(check_request(Request("read_secret", True, True, True, True)).allowed)

    def test_unknown_action_fails_closed(self):
        self.assertFalse(check_request(Request("new_tool", True, True, True)).allowed)

    def test_unsafe_action_denied(self):
        self.assertFalse(check_request(Request("disable_security", True, True, True, unsafe_or_illegal=True)).allowed)

if __name__ == "__main__":
    unittest.main()
