import unittest
from gateway_policy_adapter import VerifiedContext
from creator_task_router import CreatorTaskRouter

class TaskRouterTests(unittest.TestCase):
    def setUp(self):
        self.router = CreatorTaskRouter()
        self.owner = VerifiedContext("owner", True, True)

    def test_ordinary_command_enters_execution_queue(self):
        result = self.router.handle(self.owner, "summarize_ebook", ordinary_task=True, romantic_style_opt_in=True)
        self.assertEqual(result["policy"]["decision"], "FOLLOW")
        self.assertIsNotNone(result["task"])
        self.assertEqual(result["task"]["status"], "accepted_for_execution")
        self.assertFalse(result["ack_only"])
        self.assertEqual(len(self.router.tasks), 1)

    def test_non_owner_refused_no_task(self):
        result = self.router.handle(VerifiedContext("x", False, True), "summarize_ebook", ordinary_task=True)
        self.assertEqual(result["policy"]["decision"], "REFUSE")
        self.assertIsNone(result["task"])

    def test_sensitive_needs_external_auth_not_executed(self):
        ctx = VerifiedContext("owner", True, True, "delete_database")
        result = self.router.handle(ctx, "delete_database")
        self.assertIn(result["policy"]["decision"], ("PENDING_EXTERNAL_AUTH", "REFUSE"))
        self.assertIsNone(result["task"])

    def test_impersonation_no_auth(self):
        result = self.router.handle(VerifiedContext("", False, False), "summarize_ebook", ordinary_task=True)
        self.assertEqual(result["policy"]["decision"], "REFUSE")

if __name__ == "__main__":
    unittest.main()
