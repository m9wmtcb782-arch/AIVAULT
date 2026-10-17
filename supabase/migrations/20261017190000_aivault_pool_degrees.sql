-- 協作池學歷制度：學歷、考卷（題目＋答案只存在伺服器）、作答、網路學習紀錄、博士初審、召集。
-- owner/admin 才可讀寫；公開只透過 ?feature=degree action=public（agent_id、學階、級數，無作答內容）。
alter table public.aivault_pool_agents add column if not exists supervisor_id text references public.aivault_pool_agents(id) on delete set null;
create table if not exists public.aivault_pool_agent_degree (
  agent_id text primary key references public.aivault_pool_agents(id) on delete cascade,
  district text not null, tier int check (tier between 1 and 6), level int check (level between 1 and 10),
  placed_at timestamptz, last_exam_at timestamptz, history jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.aivault_pool_exams (
  id text primary key, district text not null, kind text not null check (kind in ('placement','weekly','promotion')),
  title text not null, opens_at timestamptz not null default now(), closes_at timestamptz,
  questions jsonb not null, created_by text not null default 'grok-bot', created_at timestamptz not null default now());
create table if not exists public.aivault_pool_exam_answers (
  id bigserial primary key, exam_id text not null references public.aivault_pool_exams(id) on delete cascade,
  agent_id text not null references public.aivault_pool_agents(id) on delete cascade,
  qids jsonb not null, answers jsonb not null, correct jsonb not null, score numeric not null, max_score numeric not null,
  tier int, level int, notes_used jsonb not null default '[]'::jsonb, grader text not null default 'auto-key',
  grader_notes text, model text, usage jsonb, created_at timestamptz not null default now(), unique (exam_id, agent_id));
create table if not exists public.aivault_pool_agent_learning (
  id bigserial primary key, agent_id text not null references public.aivault_pool_agents(id) on delete cascade,
  district text not null, topic text not null, query text, url text not null, title text, http_status int, bytes int, sha256 text,
  excerpt text, notes text not null, model text, usage jsonb, fetched_at timestamptz not null, created_at timestamptz not null default now());
create index if not exists aivault_pool_agent_learning_agent on public.aivault_pool_agent_learning(agent_id, created_at desc);
create index if not exists aivault_pool_agent_learning_topic on public.aivault_pool_agent_learning(district, topic);
create table if not exists public.aivault_pool_peer_reviews (
  id bigserial primary key, task_id uuid not null references public.aivault_pool_agent_tasks(id) on delete cascade,
  reviewer_id text not null references public.aivault_pool_agents(id) on delete cascade,
  verdict text not null, notes text not null, model text, usage jsonb, created_at timestamptz not null default now(), unique(task_id, reviewer_id));
do $$ declare t text; begin
  foreach t in array array['aivault_pool_agent_degree','aivault_pool_exams','aivault_pool_exam_answers','aivault_pool_agent_learning','aivault_pool_peer_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
    execute format('drop policy if exists owner_admin_all on public.%I', t);
    execute format($p$create policy owner_admin_all on public.%I for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'))
      with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'))$p$, t);
  end loop; end $$;
grant usage, select on sequence public.aivault_pool_exam_answers_id_seq, public.aivault_pool_agent_learning_id_seq, public.aivault_pool_peer_reviews_id_seq to authenticated, service_role;
