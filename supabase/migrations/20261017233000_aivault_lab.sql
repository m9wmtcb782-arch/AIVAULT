-- lb1：AI 實驗工廠紀錄。復原：drop table public.aivault_lab_experiments;
create table if not exists public.aivault_lab_experiments (
  id bigserial primary key, day date not null, kind text, title text not null, spec text, api text,
  lead_id text references public.aivault_pool_agents(id) on delete set null, tester_id text references public.aivault_pool_agents(id) on delete set null, ranks jsonb,
  product_js text, test_js text, demo_html text, iterations jsonb not null default '[]'::jsonb, status text not null default 'running',
  task_id uuid, tokens int default 0, created_at timestamptz not null default now(), finished_at timestamptz);
create index if not exists aivault_lab_experiments_day on public.aivault_lab_experiments(day);
alter table public.aivault_lab_experiments enable row level security; revoke all on public.aivault_lab_experiments from anon, authenticated; grant all on public.aivault_lab_experiments to service_role; grant usage on sequence public.aivault_lab_experiments_id_seq to service_role;
-- lb2：學以致用連結
alter table public.aivault_lab_experiments add column if not exists source_topic text, add column if not exists learning_ids bigint[];
alter table public.aivault_pool_agent_learning add column if not exists lab_id bigint;
