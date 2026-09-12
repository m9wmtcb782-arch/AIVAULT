import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function emitEvent(
  sb: SupabaseClient,
  taskId: string,
  fromState: string | null,
  toState: string,
  actor: string,
  reason?: string,
  attempt?: number,
  payload?: unknown,
) {
  const { error } = await sb.from("aivault_task_events").insert({
    task_id: taskId,
    from_state: fromState,
    to_state: toState,
    actor,
    reason_code: reason ?? null,
    attempt: attempt ?? null,
    payload: payload ?? {},
  });
  if (error) throw error;
}

export async function transition(
  sb: SupabaseClient,
  taskId: string,
  fromState: string,
  toState: string,
  actor: string,
  reason?: string,
  attempt?: number,
  extra?: Record<string, unknown>,
) {
  const { data: guard, error: gerr } = await sb
    .from("aivault_task_transition_guard")
    .select("to_state")
    .eq("from_state", fromState)
    .eq("to_state", toState)
    .maybeSingle();
  if (gerr) throw gerr;
  if (!guard) throw new Error(`illegal_transition:${fromState}->${toState}`);

  const patch: Record<string, unknown> = { state: toState, updated_at: new Date().toISOString(), ...(extra ?? {}) };
  if (toState === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await sb.from("aivault_tasks").update(patch).eq("task_id", taskId).eq("state", fromState).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("transition_race_or_wrong_state");
  await emitEvent(sb, taskId, fromState, toState, actor, reason, attempt, extra ?? {});
  return data;
}

export async function snapshotLedger(sb: SupabaseClient, task: Record<string, unknown>, note: string, attempt?: number) {
  await sb.from("aivault_task_ledger").insert({
    task_id: task.task_id,
    attempt: attempt ?? null,
    spent: task.spent,
    reserved: task.reserved,
    remaining: task.remaining,
    reserved_exec: task.reserved_exec,
    reserved_verify: task.reserved_verify,
    note,
  });
}
