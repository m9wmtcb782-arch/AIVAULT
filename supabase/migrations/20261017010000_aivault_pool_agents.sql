-- AI 協作池：1000 自主代理（owner/admin 才可讀寫；伺服器端以 service role 操作）
create table if not exists public.aivault_pool_agents (
  id text primary key, name text not null unique, domain text not null, specialty text not null,
  persona text not null, model_route jsonb not null default '{}'::jsonb, avatar text,
  status text not null default 'idle', stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists aivault_pool_agents_domain on public.aivault_pool_agents(domain);
create table if not exists public.aivault_pool_agent_tasks (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.aivault_pool_agent_tasks(id) on delete cascade,
  agent_id text references public.aivault_pool_agents(id) on delete set null, order_text text not null,
  status text not null default 'queued', plan jsonb not null default '[]'::jsonb, steps jsonb not null default '[]'::jsonb,
  step_no int not null default 0, max_steps int not null default 5, result text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists aivault_pool_agent_tasks_parent on public.aivault_pool_agent_tasks(parent_id);
create index if not exists aivault_pool_agent_tasks_agent on public.aivault_pool_agent_tasks(agent_id, created_at desc);
create table if not exists public.aivault_pool_agent_memory (
  id bigserial primary key, agent_id text not null references public.aivault_pool_agents(id) on delete cascade,
  kind text not null default 'note', content text not null, task_id uuid, created_at timestamptz not null default now());
create index if not exists aivault_pool_agent_memory_agent on public.aivault_pool_agent_memory(agent_id, created_at desc);
create table if not exists public.aivault_pool_agent_usage (
  day date not null default current_date, provider text not null, calls int not null default 0, primary key (day, provider));
do $$ declare t text; begin
  foreach t in array array['aivault_pool_agents','aivault_pool_agent_tasks','aivault_pool_agent_memory','aivault_pool_agent_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists owner_admin_all on public.%I', t);
    execute format($p$create policy owner_admin_all on public.%I for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'))
      with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'))$p$, t);
  end loop; end $$;
grant usage, select on sequence public.aivault_pool_agent_memory_id_seq to authenticated;
create or replace function public.aivault_pool_usage_bump(p text) returns void language sql security definer set search_path = public as
$$ insert into aivault_pool_agent_usage(day, provider, calls) values (current_date, p, 1) on conflict (day, provider) do update set calls = aivault_pool_agent_usage.calls + 1 $$;
revoke all on function public.aivault_pool_usage_bump(text) from public, anon, authenticated;
