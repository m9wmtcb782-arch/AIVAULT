/**
 * Deterministic lock-serialization model of the two RPCs.
 * Mirrors aivault_reserve_attempt / aivault_claim_settlement after FOR UPDATE.
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

type Task = {
  max: number;
  spent: number;
  reserved: number;
  attempt_count: number;
  max_attempts: number;
  state: string;
};

function reserve(task: Task, needExec: number, needVerify: number) {
  const need = needExec + needVerify;
  const remaining = task.max - task.spent - task.reserved;
  if (task.state !== "queued") return { ok: false, reason: "wrong_state", attempt: false };
  if (task.attempt_count >= task.max_attempts) {
    task.state = "settlement_blocked";
    return { ok: false, reason: "max_attempts", attempt: false };
  }
  if (remaining < need) {
    task.state = "settlement_blocked";
    return { ok: false, reason: "insufficient_remaining", attempt: false };
  }
  task.reserved += need;
  task.attempt_count += 1;
  task.state = "matched";
  return { ok: true, attempt: true };
}

Deno.test("A concurrent reserve: only one of two 180-need requests succeeds on budget 200", () => {
  const task: Task = {
    max: 200,
    spent: 0,
    reserved: 0,
    attempt_count: 0,
    max_attempts: 3,
    state: "queued",
  };
  const a = reserve(task, 160, 20);
  const b = reserve(task, 160, 20);
  assert(a.ok && a.attempt, "first reserve succeeds");
  assert(!b.ok && !b.attempt, "second reserve creates no attempt");
  assert(task.attempt_count === 1, "exactly one attempt");
  assert(task.spent + task.reserved <= task.max, "no overspend");
  assert(task.reserved === 180, "reserved is 180");
  assert(task.state === "settlement_blocked" || b.reason === "wrong_state" || b.reason === "insufficient_remaining", "second rejected");
});

Deno.test("B concurrent settlement: second claim is already_claimed, one settlement", () => {
  const settlements: Array<{ task: string; attempt: number; credit: number }> = [];
  function claim(task: string, attempt: number, credit: number) {
    const existing = settlements.find((s) => s.task === task && s.attempt === attempt);
    if (existing) return { ok: true, duplicate: true, settlement: existing };
    settlements.push({ task, attempt, credit });
    return { ok: true, duplicate: false };
  }
  const first = claim("t1", 1, 10);
  const second = claim("t1", 1, 10);
  assert(first.ok && first.duplicate === false, "first inserts");
  assert(second.ok && second.duplicate === true, "second already_claimed");
  assert(settlements.length === 1, "one settlement row");
  assert(settlements[0].credit === 10, "credits not doubled");
});
