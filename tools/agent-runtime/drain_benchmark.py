"""Exercise the real SQLite queue with deterministic, offline benchmark work."""
import argparse
import hashlib
import json
import resource
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from threading import Barrier

import runtime

COUNT = 100_000
WORKERS = 4
CRASH_LEASE_SECONDS = 1


def claim_before_crash(path):
    runtime.LEASE_SECONDS = CRASH_LEASE_SECONDS
    with closing(runtime.connect(path)) as db:
        jobs = [runtime.claim(db) for _ in range(WORKERS)]
        print(json.dumps(jobs), flush=True)
        time.sleep(30)


def inject_crash(path):
    command = [sys.executable, str(Path(__file__).resolve()), str(path), "--crash-child"]
    with subprocess.Popen(command, stdout=subprocess.PIPE, text=True) as child:
        try:
            jobs = json.loads(child.stdout.readline())
        finally:
            child.kill()
            child.wait()
    if len(jobs) != WORKERS or any(job is None for job in jobs):
        raise RuntimeError("child failed to claim all four leases")
    # Let the real database leases expire before starting replacement workers.
    time.sleep(CRASH_LEASE_SECONDS)
    return jobs


def drain(path, barrier):
    with closing(runtime.connect(path)) as db:
        job = runtime.claim(db)
        if job is None:
            barrier.abort()
            raise RuntimeError("replacement worker could not claim a lease")
        barrier.wait(timeout=30)
        processed = 0
        while job is not None:
            task_id, agent_id, run_id, _ = job
            payload = f"{task_id}:{agent_id}:{run_id}".encode()
            evidence = {"kind": "offline_benchmark", "sha256": hashlib.sha256(payload).hexdigest()}
            if not runtime.finish(db, task_id, run_id, "verified_completed", evidence):
                raise RuntimeError(f"lost active lease for task {task_id}")
            processed += 1
            job = runtime.claim(db)
        return processed


def verify(db, old_jobs):
    metrics = runtime.metrics(db)
    if (metrics["registered"], metrics["verified_completed"], metrics["queued"],
        metrics["running"], metrics["failed"], metrics["max_concurrent_workers"]) != (
        COUNT, COUNT, 0, 0, 0, WORKERS
    ):
        raise RuntimeError(f"unexpected final queue metrics: {metrics}")
    attempts = dict(db.execute("SELECT attempt, count(*) FROM task GROUP BY attempt"))
    if attempts != {1: COUNT - WORKERS, 2: WORKERS}:
        raise RuntimeError(f"unexpected attempt counts: {attempts}")
    rejected = sum(not runtime.finish(db, task_id, run_id, "verified_completed", {})
                   for task_id, _, run_id, _ in old_jobs)
    if rejected != WORKERS:
        raise RuntimeError("a stale completion was accepted")
    audit = dict(db.execute("SELECT event, count(*) FROM audit GROUP BY event"))
    if audit != {"claimed": COUNT + WORKERS, "lease_expired": WORKERS, "verified_completed": COUNT}:
        raise RuntimeError(f"unexpected audit counts: {audit}")
    distinct_runs = db.execute("SELECT count(DISTINCT run_id) FROM audit WHERE event='claimed'").fetchone()[0]
    mismatched = db.execute("""
        SELECT count(*) FROM task AS t
        LEFT JOIN (
            SELECT task_id, min(run_id) AS run_id, count(*) AS finishes
            FROM audit WHERE event='verified_completed' GROUP BY task_id
        ) AS a ON a.task_id=t.id
        WHERE a.finishes IS NOT 1 OR a.run_id IS NOT t.run_id
    """).fetchone()[0]
    if distinct_runs != COUNT + WORKERS or mismatched:
        raise RuntimeError("audit run IDs or task completions do not reconcile")
    return {"tasks": metrics, "audit_events": audit, "distinct_claimed_runs": distinct_runs,
            "stale_completions_rejected": rejected}


def benchmark(path):
    if path.exists():
        raise FileExistsError(path)
    with closing(runtime.connect(path)) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript(runtime.SCHEMA)
        runtime.seed(db, COUNT, "offline-drain")
    old_jobs = inject_crash(path)
    barrier = Barrier(WORKERS)
    started = time.perf_counter()
    cpu_start = time.process_time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        counts = list(pool.map(lambda _: drain(path, barrier), range(WORKERS)))
    wall = time.perf_counter() - started
    cpu = time.process_time() - cpu_start
    with closing(runtime.connect(path)) as db:
        report = verify(db, old_jobs)
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    report.update({
        "workload": "offline SHA-256 test payload",
        "worker_completions": counts,
        "drain_wall_seconds": round(wall, 3),
        "drain_cpu_seconds": round(cpu, 3),
        "drain_tasks_per_second": round(COUNT / wall, 3),
        "benchmark_process_peak_rss_bytes": peak * (1 if sys.platform == "darwin" else 1024),
        "database_bytes": path.stat().st_size,
    })
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("--crash-child", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.crash_child:
        claim_before_crash(args.database)
    else:
        benchmark(args.database)
