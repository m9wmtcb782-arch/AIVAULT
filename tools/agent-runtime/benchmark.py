"""Run fresh, separate live-tool and queue-capacity measurements on macOS/Linux."""
import argparse
import json
import resource
import subprocess
import sys
import time
from pathlib import Path

RUNTIME = Path(__file__).with_name("runtime.py")


def invoke(database, *args):
    return subprocess.check_output([sys.executable, str(RUNTIME), str(database), *args], text=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path, help="New directory for evidence and databases")
    args = parser.parse_args()
    args.output.mkdir()
    live = args.output / "live.sqlite"
    invoke(live, "seed", "100", "--batch", "github-readme")
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    started = time.perf_counter()
    metrics = json.loads(invoke(live, "run", "--workers", "4"))
    elapsed = time.perf_counter() - started
    after = resource.getrusage(resource.RUSAGE_CHILDREN)
    events = invoke(live, "audit")
    (args.output / "github-readme.jsonl").write_text(events)
    timings = sorted(row["evidence"]["elapsed_ms"] for row in map(json.loads, events.splitlines())
                     if row["event"] == "verified_completed")
    live_report = {
        **metrics,
        "wall_seconds": round(elapsed, 3),
        "cpu_seconds": round(after.ru_utime + after.ru_stime - before.ru_utime - before.ru_stime, 3),
        "peak_child_rss_bytes": after.ru_maxrss * (1 if sys.platform == "darwin" else 1024),
        "verified_per_second": round(len(timings) / elapsed, 3),
        "verified_p95_ms": timings[(len(timings) * 95 + 99) // 100 - 1] if timings else None,
    }
    capacities = []
    for count in (1_000, 10_000, 100_000):
        database = args.output / f"capacity-{count}.sqlite"
        started = time.perf_counter()
        metrics = json.loads(invoke(database, "seed", str(count), "--batch", "capacity"))
        elapsed = time.perf_counter() - started
        assert metrics["registered"] == metrics["queued"] == count
        assert json.loads(invoke(database, "seed", str(count), "--batch", "capacity")) == metrics
        capacities.append({**metrics, "wall_seconds": round(elapsed, 3),
                           "database_bytes": database.stat().st_size})
    report = {"live": live_report, "queue_capacity_only": capacities}
    encoded = json.dumps(report, indent=2)
    (args.output / "summary.json").write_text(encoded + "\n")
    print(encoded)
    return 0 if live_report["verified_completed"] == 100 else 1


if __name__ == "__main__":
    sys.exit(main())
