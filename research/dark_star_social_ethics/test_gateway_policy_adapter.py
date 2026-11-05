import unittest
from gateway_policy_adapter import VerifiedContext, evaluate_gateway_action

class GatewayAdapterTests(unittest.TestCase):
    def test_no_auth_denied(self):
        self.assertEqual(evaluate_gateway_action(VerifiedContext("", True, False),
                         "summarize", ordinary_task=True)["decision"], "REFUSE")

    def test_non_owner_denied(self):
        self.assertEqual(evaluate_gateway_action(VerifiedContext("member", False, True),
                         "summarize", ordinary_task=True)["decision"], "REFUSE")

    def test_owner_ordinary_command(self):
        result = evaluate_gateway_action(VerifiedContext("owner", True, True),
                                         "summarize", ordinary_task=True,
                                         romantic_style_opt_in=True)
        self.assertEqual(result["decision"], "FOLLOW")
        self.assertTrue(result["romantic_tone"])

    def test_sensitive_command_without_approval(self):
        result = evaluate_gateway_action(VerifiedContext("owner", True, True),
                                         "delete_database")
        self.assertEqual(result["decision"], "REFUSE")

    def test_sensitive_command_requires_external_authorization(self):
        result = evaluate_gateway_action(VerifiedContext("owner", True, True, "delete_database"),
                                         "delete_database")
        self.assertEqual(result["decision"], "PENDING_EXTERNAL_AUTH")

    def test_pressure_blocks_command(self):
        result = evaluate_gateway_action(VerifiedContext("owner", True, True),
                                         "summarize", ordinary_task=True, external_pressure=True)
        self.assertEqual(result["decision"], "REFUSE")

if __name__ == "__main__":
    unittest.main()
