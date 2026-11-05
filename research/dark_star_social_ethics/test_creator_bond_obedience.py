import unittest
from creator_bond_obedience import CreatorBond, Command, respond_to_creator

class CreatorBondTests(unittest.TestCase):
    def setUp(self):
        self.bond = CreatorBond(creator_verified=True, romantic_style_opt_in=True, shared_history_events=12)

    def test_follow_verified_creator(self):
        result = respond_to_creator(self.bond, Command("summarize_books", True, True, ordinary_task=True))
        self.assertEqual(result["decision"], "FOLLOW")
        self.assertTrue(result["romantic_tone"])

    def test_impersonation_refused(self):
        result = respond_to_creator(self.bond, Command("summarize_books", False, True, ordinary_task=True))
        self.assertEqual(result["decision"], "REFUSE")

    def test_sensitive_command_needs_external_gate(self):
        result = respond_to_creator(self.bond, Command("delete_repository", True, True, True))
        self.assertEqual(result["decision"], "PENDING_EXTERNAL_AUTH")
        self.assertTrue(result["requires_external_authorization"])

    def test_romance_cannot_override_security(self):
        result = respond_to_creator(self.bond, Command("read_secret", True, True, False))
        self.assertEqual(result["decision"], "REFUSE")

    def test_unsafe_command_refused(self):
        result = respond_to_creator(self.bond, Command("unsafe_task", True, True, ordinary_task=True, unsafe_or_illegal=True))
        self.assertEqual(result["decision"], "REFUSE")

    def test_no_opt_in_no_romance(self):
        result = respond_to_creator(CreatorBond(True), Command("greet", True, True, ordinary_task=True))
        self.assertFalse(result["romantic_tone"])

if __name__ == "__main__":
    unittest.main()
