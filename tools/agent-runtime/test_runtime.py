"""Regression checks for concurrent claims, restart, and stale completions."""
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

import runtime


class QueueTests(unittest.TestCase):
    def test_claim_limit_and_expired_attempt_fencing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "runtime.sqlite"
            with closing(runtime.connect(path)) as db:
                db.executescript(runtime.SCHEMA)
                runtime.seed(db, 8, "test")
                runtime.seed(db, 8, "test")

                def claim():
                    with closing(runtime.connect(path)) as worker_db:
                        return runtime.claim(worker_db)

                with ThreadPoolExecutor(max_workers=8) as pool:
                    jobs = [job for job in pool.map(lambda _: claim(), range(8)) if job]
                self.assertEqual(len({job[0] for job in jobs}), 4)
                self.assertEqual(runtime.metrics(db)["queued"], 4)

                task_id, _, first_run, _ = jobs[0]
                with db:
                    db.execute("UPDATE task SET lease_until=0 WHERE id=?", (task_id,))

            with closing(runtime.connect(path)) as db:
                for expected_attempt in (2, 3):
                    recovered_id, _, run_id, attempt = runtime.claim(db)
                    self.assertEqual((recovered_id, attempt), (task_id, expected_attempt))
                    self.assertNotEqual(run_id, first_run)
                    self.assertFalse(runtime.finish(db, task_id, first_run, "verified_completed", {}))
                    with db:
                        db.execute("UPDATE task SET lease_until=0 WHERE id=?", (task_id,))
                runtime.claim(db)
                self.assertEqual(runtime.metrics(db)["failed"], 1)
                self.assertEqual(runtime.metrics(db)["verified_completed"], 0)
                self.assertEqual(db.execute(
                    "SELECT count(*) FROM audit WHERE task_id=? AND event='lease_expired'",
                    (task_id,),
                ).fetchone()[0], 3)


if __name__ == "__main__":
    unittest.main()
