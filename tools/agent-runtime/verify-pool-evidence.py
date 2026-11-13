"""Recount unique roster identities from the committed local Qwen acceptance evidence."""
import argparse
import csv
import json
import re
import uuid
from pathlib import Path


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def verify_row(row):
    require(row["state"] == "COMPLETED", "run did not complete")
    identity = row["registry_id_sha256"]
    require(re.fullmatch(r"[0-9a-f]{64}", identity), "invalid identity hash")
    run_id = uuid.UUID(row["run_id"])
    tool = row["tool"]
    name = row["expected_tool"]
    require(name in {"MIN", "MAX"} and tool["name"] == name, "wrong tool")
    left, right = (tool["input"][key] for key in ("left", "right"))
    require(type(left) is int and type(right) is int, "invalid operands")
    result = (min if name == "MIN" else max)(left, right)
    require(tool["value"] == result and row["answer"] == str(result), "wrong result")

    calls = row["calls"]
    require(len(calls) >= 2, "missing model calls")
    tokens = [call.get("tokens", call.get("usage", {}).get("completion_tokens")) for call in calls]
    require(all(type(count) is int and count > 0 for count in tokens), "missing generation evidence")
    for index, call in enumerate(calls[:-1]):
        accepted = index == len(calls) - 2
        choice = re.fullmatch(r"(?:tool:\s*)?(MIN|MAX)\.?", call["answer"].strip(), re.I)
        matches = choice is not None and choice[1].upper() == name
        require(call["phase"] == "select_tool" and matches == accepted and
                call["tool_check"] == ("accepted" if accepted else "rejected"),
                "model selection does not match tool record")
    require(calls[-1]["phase"] == "report_result" and calls[-1]["answer"].strip() == str(result),
            "model report does not match verified tool result")
    return identity, run_id, tokens


def verify(directory):
    guarded = json.loads((directory / "pool-guarded-sample.json").read_text())
    paths = sorted(directory.glob("pool-acceptance-*.jsonl"))
    require(paths, "no pool acceptance batches")
    batches = {"pool-guarded-sample": guarded["rows"]}
    for path in paths:
        batch = re.sub(r"-part\d+$", "", path.stem)
        batches.setdefault(batch, []).extend(
            row for row in map(json.loads, path.read_text().splitlines()) if "summary" not in row
        )
    identities, run_ids = set(), set()
    calls_total = server_calls = tokens_total = 0
    for batch, rows in batches.items():
        require(rows, f"{batch}: no run records")
        tokens = []
        for row in rows:
            try:
                identity, run_id, counts = verify_row(row)
                require(identity not in identities, "duplicate identity")
                require(run_id not in run_ids, "duplicate run ID")
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"{batch}, run {row.get('run_id', 'missing')}: {error}") from error
            identities.add(identity)
            run_ids.add(run_id)
            tokens.extend(counts)
        calls_total += len(tokens)
        tokens_total += sum(tokens)
        server_path = directory / f"{batch}-server-eval.csv"
        if server_path.exists():
            with server_path.open(newline="") as handle:
                server_tokens = [int(row["generated_tokens"]) for row in csv.DictReader(handle)]
            require(sorted(server_tokens) == sorted(tokens), f"{batch}: server token counts differ")
            server_calls += len(server_tokens)
    return {
        "scope": "committed local sample evidence; no live inference",
        "distinct_roster_identities": len(identities),
        "model_calls_in_run_records": calls_total,
        "generated_tokens_in_run_records": tokens_total,
        "calls_cross_checked_by_batch_token_distribution": server_calls,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, nargs="?", default=Path(__file__).with_name("evidence"))
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.directory), indent=2))
    except (KeyError, OSError, TypeError, ValueError) as error:
        parser.exit(1, f"Evidence verification failed: {error}\n")
