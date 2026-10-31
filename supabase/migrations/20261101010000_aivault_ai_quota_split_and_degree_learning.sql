-- AIVAULT AI 額度分配（協作池討論＋學習 ≤ 50%，暗星 AI 保留 50%）＋ 依學歷的持續學習計畫。
-- FILE ONLY — 尚未套用到線上。只新增物件；不修改 ai-gateway、既有表或既有記憶。
-- 額度日界：與 ai-gateway 相同，使用 Pacific 時區日（Gemini/Groq 免費額度重置窗）。

create table if not exists public.aivault_ai_quota_config (
  provider     text primary key,                          -- 例如 'gemini','groq'
  daily_total  integer check (daily_total is null or daily_total > 0), -- 開創者設定的每日總額度（次）；NULL = 來源未知 → 協作池一律拒絕（fail-closed）
  pool_share   numeric not null default 0.5 check (pool_share > 0 and pool_share <= 0.5), -- 上限寫死 ≤ 0.5
  source_note  text,                                      -- 額度數字的來源說明（官方頁面、帳號後台）
  updated_by   text, updated_at timestamptz not null default now());

create table if not exists public.aivault_ai_quota_ledger (
  id        bigserial primary key,
  quota_day date not null default ((now() at time zone 'America/Los_Angeles')::date),
  provider  text not null,
  consumer  text not null check (consumer in ('darkstar','pool_discussion','pool_learning','other')),
  units     integer not null default 1 check (units between 1 and 100),
  decision  text not null check (decision in ('ALLOWED','DENIED')),
  reason    text not null,
  ref       text,
  created_at timestamptz not null default now());
create index if not exists aivault_ai_quota_ledger_day on public.aivault_ai_quota_ledger(quota_day, provider, consumer) where decision = 'ALLOWED';

-- 原子化預留：在呼叫 AI 之前執行；鎖住 config 列避免併發超額。
create or replace function public.aivault_ai_quota_reserve(p_provider text, p_consumer text, p_units integer default 1, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; d date := (now() at time zone 'America/Los_Angeles')::date;
  pool_used int; ds_used int; total_used int; pool_cap int; ds_reserve_left int; ok boolean; why text;
begin
  if p_consumer not in ('darkstar','pool_discussion','pool_learning','other') then raise exception 'INVALID_CONSUMER'; end if;
  select * into c from aivault_ai_quota_config where provider = p_provider for update;
  select coalesce(sum(units) filter (where consumer in ('pool_discussion','pool_learning')),0),
         coalesce(sum(units) filter (where consumer = 'darkstar'),0), coalesce(sum(units),0)
    into pool_used, ds_used, total_used
    from aivault_ai_quota_ledger where quota_day = d and provider = p_provider and decision = 'ALLOWED';
  if p_consumer in ('darkstar','other') then
    ok := true; why := 'NOT_POOL_CONSUMER';             -- 暗星不受協作池上限限制（只記帳）
  elsif c is null or c.daily_total is null then
    ok := false; why := 'QUOTA_SOURCE_UNKNOWN';         -- 不知道總額度就不讓協作池用
  else
    pool_cap := floor(c.daily_total * c.pool_share);
    ds_reserve_left := greatest(0, (c.daily_total - pool_cap) - ds_used);
    if pool_used + p_units > pool_cap then ok := false; why := 'POOL_HALF_EXHAUSTED';
    elsif total_used + p_units > c.daily_total - ds_reserve_left then ok := false; why := 'DARKSTAR_RESERVE_PROTECTED';
    else ok := true; why := 'WITHIN_POOL_HALF'; end if;
  end if;
  insert into aivault_ai_quota_ledger(quota_day, provider, consumer, units, decision, reason, ref)
    values (d, p_provider, p_consumer, p_units, case when ok then 'ALLOWED' else 'DENIED' end, why, p_ref);
  return jsonb_build_object('allowed', ok, 'reason', why, 'day', d, 'daily_total', c.daily_total, 'pool_cap', pool_cap,
    'pool_used', pool_used + case when ok and p_consumer like 'pool_%' then p_units else 0 end, 'darkstar_used', ds_used, 'total_used', total_used);
end $$;

create or replace view public.aivault_ai_quota_today as
select c.provider, c.daily_total, floor(c.daily_total * c.pool_share)::int as pool_cap, c.daily_total - floor(c.daily_total * c.pool_share)::int as darkstar_reserved,
  coalesce(sum(l.units) filter (where l.consumer in ('pool_discussion','pool_learning') and l.decision='ALLOWED'),0) as pool_used,
  coalesce(sum(l.units) filter (where l.consumer = 'darkstar' and l.decision='ALLOWED'),0) as darkstar_used,
  count(*) filter (where l.decision='DENIED') as denied
from aivault_ai_quota_config c
left join aivault_ai_quota_ledger l on l.provider = c.provider and l.quota_day = (now() at time zone 'America/Los_Angeles')::date
group by c.provider, c.daily_total, c.pool_share;

-- 依學歷的學習計畫（讀取既有 aivault_pool_agent_degree，不修改它）
create table if not exists public.aivault_pool_degree_learning_plan (
  id bigserial primary key,
  agent_id text not null references public.aivault_pool_agents(id) on delete cascade,
  district text not null, tier int not null check (tier between 1 and 6), level int not null check (level between 1 and 10),
  topic text not null, objective text not null,
  status text not null default 'queued' check (status in ('queued','done','failed','skipped_quota')),
  memory_id bigint,                         -- 寫入 aivault_pool_agent_memory 後的 id（只新增，不覆蓋）
  attempts int not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (agent_id, topic, tier, level));

do $$ declare t text; begin
  foreach t in array array['aivault_ai_quota_config','aivault_ai_quota_ledger','aivault_pool_degree_learning_plan'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
    execute format('drop policy if exists owner_admin_read on public.%I', t);
    execute format($p$create policy owner_admin_read on public.%I for select to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'))$p$, t);
  end loop; end $$;
revoke all on function public.aivault_ai_quota_reserve(text,text,integer,text) from public, anon, authenticated;
grant execute on function public.aivault_ai_quota_reserve(text,text,integer,text) to service_role;
-- 帳本只能新增
create or replace function public.aivault_ai_quota_ledger_append_only() returns trigger language plpgsql as $$ begin raise exception 'LEDGER_APPEND_ONLY'; end $$;
drop trigger if exists aivault_ai_quota_ledger_ro on public.aivault_ai_quota_ledger;
create trigger aivault_ai_quota_ledger_ro before update or delete on public.aivault_ai_quota_ledger for each row execute function public.aivault_ai_quota_ledger_append_only();
