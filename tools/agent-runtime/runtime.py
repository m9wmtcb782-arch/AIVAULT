"""Persistent, bounded worker for pinned AIVAULT GitHub README verification."""
import argparse
import json
import sqlite3
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

TOOL = Path(__file__).with_name("github-read.mjs")
LEASE_SECONDS = 60
MAX_ATTEMPTS = 3
MAX_PENDING = 100_000

SCHEMA = """
CREATE TABLE IF NOT EXISTS agent(id INTEGER PRIMARY KEY CHECK(id > 0));
CREATE TABLE IF NOT EXISTS task(
    id INTEGER PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agent(id),
    batch TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'queued',
    attempt INTEGER NOT NULL DEFAULT 0,
    lease_until REAL,
    run_id TEXT,
    UNIQUE(batch, agent_id)
);
CREATE INDEX IF NOT EXISTS task_state ON task(state, id);
CREATE INDEX IF NOT EXISTS task_lease ON task(state, lease_until);
CREATE TABLE IF NOT EXISTS audit(
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES task(id),
    run_id TEXT NOT NULL,
    at REAL NOT NULL,
    event TEXT NOT NULL,
    evidence TEXT
);
"""


def connect(path):
    db = sqlite3.connect(path, timeout=30, isolation_level="IMMEDIATE")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def seed(db, count, batch=None):
    with db:
        db.executemany("INSERT OR IGNORE INTO agent VALUES (?)",
                       ((agent,) for agent in range(1, count + 1)))
        if batch is not None:
            pending = db.execute(
                "SELECT count(*) FROM task WHERE state IN ('queued', 'running')"
            ).fetchone()[0]
            existing = db.execute(
                "SELECT count(*) FROM task WHERE batch=? AND agent_id<=?", (batch, count)
            ).fetchone()[0]
            if pending + count - existing > MAX_PENDING:
                raise ValueError("queue capacity exceeded")
            db.execute(
                "INSERT OR IGNORE INTO task(agent_id, batch) SELECT id, ? FROM agent WHERE id<=?",
                (batch, count),
            )


def audit(db, task_id, run_id, at, event, evidence=None):
    db.execute("INSERT INTO audit(task_id, run_id, at, event, evidence) VALUES (?, ?, ?, ?, ?)",
               (task_id, run_id, at, event, json.dumps(evidence) if evidence else None))


def claim(db):
    with db:
        db.execute("BEGIN IMMEDIATE")
        now = time.time()
        expired = db.execute("""
            UPDATE task SET state=CASE WHEN attempt>=? THEN 'failed' ELSE 'queued' END,
                lease_until=NULL WHERE state='running' AND lease_until<=?
            RETURNING id, run_id, state
        """, (MAX_ATTEMPTS, now)).fetchall()
        for task_id, run_id, state in expired:
            audit(db, task_id, run_id, now, "lease_expired", {"state": state})
        active = db.execute("SELECT count(*) FROM task WHERE state='running'").fetchone()[0]
        if active >= 4:
            return None
        run_id = uuid.uuid4().hex
        row = db.execute("""
            UPDATE task SET state='running', attempt=attempt+1, run_id=?, lease_until=?
            WHERE id=(SELECT id FROM task WHERE state='queued' ORDER BY id LIMIT 1)
            RETURNING id, agent_id, run_id, attempt
        """, (run_id, now + LEASE_SECONDS)).fetchone()
        if row:
            audit(db, row[0], run_id, now, "claimed", {"concurrent_workers": active + 1})
        return row


def finish(db, task_id, run_id, state, evidence):
    with db:
        db.execute("BEGIN IMMEDIATE")
        now = time.time()
        changed = db.execute("""
            UPDATE task SET state=?, lease_until=NULL
            WHERE id=? AND run_id=? AND state='running' AND lease_until>?
        """, (state, task_id, run_id, now)).rowcount
        if changed:
            audit(db, task_id, run_id, now, state, evidence)
        return bool(changed)


def worker(path):
    with closing(connect(path)) as db:
        while (job := claim(db)) is not None:
            task_id, agent_id, run_id, attempt = job
            started = time.monotonic()
            try:
                result = subprocess.run(
                    ["node", "--experimental-transform-types", str(TOOL), str(agent_id), run_id],
                    capture_output=True, text=True, timeout=15, check=True,
                )
                evidence = json.loads(result.stdout)
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                evidence = {"error_type": type(error).__name__}
            if evidence.get("state") == "COMPLETED":
                state = "verified_completed"
            else:
                state = "queued" if attempt < MAX_ATTEMPTS else "failed"
            evidence["elapsed_ms"] = round((time.monotonic() - started) * 1000, 3)
            finish(db, task_id, run_id, state, evidence)
            if state == "queued":
                time.sleep(2 ** attempt)


def metrics(db):
    states = dict(db.execute("SELECT state, count(*) FROM task GROUP BY state"))
    peak = db.execute("""
        SELECT coalesce(max(json_extract(evidence, '$.concurrent_workers')), 0)
        FROM audit WHERE event='claimed'
    """).fetchone()[0]
    return {
        "registered": db.execute("SELECT count(*) FROM agent").fetchone()[0],
        **{state: states.get(state, 0)
           for state in ("queued", "running", "verified_completed", "failed")},
        "real_model_calls": 0,
        "max_concurrent_workers": peak,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("database")
    commands = parser.add_subparsers(dest="command", required=True)
    register = commands.add_parser("seed")
    register.add_argument("count", type=int, choices=range(1, 100_001), metavar="1..100000")
    register.add_argument("--batch")
    run = commands.add_parser("run")
    run.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    commands.add_parser("metrics")
    commands.add_parser("audit")
    args = parser.parse_args()
    with closing(connect(args.database)) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript(SCHEMA)
        if args.command == "seed":
            seed(db, args.count, args.batch)
        elif args.command == "run":
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                list(pool.map(worker, [args.database] * args.workers))
        elif args.command == "audit":
            db.row_factory = sqlite3.Row
            for row in db.execute("""
                SELECT task.agent_id, task.batch, audit.* FROM audit
                JOIN task ON task.id=audit.task_id ORDER BY audit.id
            """):
                event = dict(row)
                event["evidence"] = json.loads(event["evidence"])
                print(json.dumps(event))
            return
        print(json.dumps(metrics(db)))


if __name__ == "__main__":
    main()
