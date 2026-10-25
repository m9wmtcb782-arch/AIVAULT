import unittest
from creator_memory_isolation import CreatorMemoryStore, DISCLAIMER

class MemoryIsolationTests(unittest.TestCase):
    def setUp(self):
        self.store = CreatorMemoryStore()
        self.creator = CreatorMemoryStore.scope_for(authenticated=True, is_owner=True, subject="owner-1")
        self.visitor = CreatorMemoryStore.scope_for(authenticated=False, is_owner=False, subject="")
        self.other = CreatorMemoryStore.scope_for(authenticated=True, is_owner=False, subject="user-2")

    def test_creator_scope_key(self):
        self.assertEqual(self.creator, "creator:owner-1")
        self.assertEqual(self.visitor, "visitor:anon")

    def test_visitor_cannot_read_creator_memory(self):
        self.store.write(self.creator, "bond", "共同經歷：第一基地開建", romantic=True)
        self.assertEqual(len(self.store.read_as(reader_scope=self.visitor, target_scope=self.creator)), 0)
        self.assertEqual(len(self.store.read_as(reader_scope=self.other, target_scope=self.creator)), 0)
        self.assertEqual(len(self.store.read_as(reader_scope=self.creator, target_scope=self.creator)), 1)

    def test_romantic_write_blocked_outside_creator_scope(self):
        with self.assertRaises(PermissionError):
            self.store.write(self.other, "bond", "x", romantic=True)

    def test_disclaimer_present(self):
        self.assertIn("人工情感模擬", DISCLAIMER)

if __name__ == "__main__":
    unittest.main()
