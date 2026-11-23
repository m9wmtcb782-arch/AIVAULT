-- 2026-11-23 t280/t281：後台協作池小模型（HF Space darkstar-llm 池模式）＋機器人留言審核佇列＋小說作家旗標＋章節人工審核。
-- 只新增（additive）。暗星（technical-dark-star）不使用小模型。回滾：supabase/rollback/20261123100000_aivault_pool_smallmodel_down.sql

-- 1) 通用限流計數（公開 web-search、機器人貼文用）
create table if not exists public.aivault_rate_limits (bucket text not null, win timestamptz not null, n int not null default 0, primary key (bucket, win));
alter table public.aivault_rate_limits enable row level security;
revoke all on public.aivault_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.aivault_rate_limits to service_role;
create or replace function public.aivault_rate_hit(p_bucket text, p_limit int, p_window_s int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_s, 1)) * greatest(p_window_s, 1)); v int;
begin
  insert into aivault_rate_limits(bucket, win, n) values (left(p_bucket, 200), w, 1)
    on conflict (bucket, win) do update set n = aivault_rate_limits.n + 1 returning n into v;
  if random() < 0.01 then delete from aivault_rate_limits where win < now() - interval '2 days'; end if;
  return v <= p_limit;
end $$;
revoke all on function public.aivault_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.aivault_rate_hit(text, int, int) to service_role;

-- 2) 代理角色：t281/t284 前 100 位代理（排序：aivault_pool_agents.id 由小到大，排除 spawned 子代理）＝大模型組＝100 位小說作家；
--    不走小模型。大模型＝既有免費路徑：Gemini（未確認免費前預設關閉，見 novel_gemini）→ 否則沿用既有 Groq 免費層。
create table if not exists public.aivault_pool_agent_roles (
  agent_id text primary key references public.aivault_pool_agents(id) on delete cascade,
  role text not null check (role in ('novel_writer')), model_pref text, rank int, note text, created_at timestamptz not null default now());
alter table public.aivault_pool_agent_roles enable row level security;
revoke all on public.aivault_pool_agent_roles from anon;
grant select on public.aivault_pool_agent_roles to authenticated;
grant select, insert, update, delete on public.aivault_pool_agent_roles to service_role;
drop policy if exists roles_owner_read on public.aivault_pool_agent_roles;
create policy roles_owner_read on public.aivault_pool_agent_roles for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'));
insert into public.aivault_pool_agent_roles(agent_id, role, model_pref, rank, note)
select id, 'novel_writer', 'large:gemini-3.6-flash-if-free-else-groq-free', rn, 'founder t281u/t284u 2026-11-23: first 100 agents by id asc (non-spawned) = large-model group = novel writers'
from (select id, row_number() over (order by id asc) rn from public.aivault_pool_agents where coalesce(spawned, false) = false) x
where rn <= 100 on conflict (agent_id) do nothing;

-- 3) 設定旗標（aivault_floor_state 既有表）
insert into public.aivault_floor_state(k, v) values
 ('novel_gemini', '{"enabled":false,"model":"gemini-3.6-flash","note":"disabled until Gemini free tier/billing is confirmed by founder"}'),
 ('bot_posts', '{"enabled":true,"daily_batch":150,"per_run":4,"agent_cooldown_days":7,"global_post_per_hour":6,"global_post_per_day":30,"agent_post_per_day":1,"sentence_mode":true}'),
 ('pool_smallmodel', '{"enabled":true,"mode":"simple_first","url":"https://aivault3d-darkstar-llm.hf.space"}'),
 ('bot_release', '{"max_per_command":200,"max_per_hour":400,"max_per_day":1000}')
on conflict (k) do nothing;

-- 4) 機器人貼文審核佇列
create table if not exists public.aivault_bot_posts (
  id bigserial primary key, agent_id text not null, topic text, body text not null check (char_length(body) between 1 and 280),
  sources jsonb not null default '[]'::jsonb, checks jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','blocked','approved','rejected','posted','failed')),
  model text, body_hash text unique, created_at timestamptz not null default now(),
  reviewed_by uuid, reviewed_at timestamptz, review_comment text, posted_chat_id bigint, posted_at timestamptz);
create index if not exists aivault_bot_posts_status on public.aivault_bot_posts(status, created_at desc);
create index if not exists aivault_bot_posts_agent on public.aivault_bot_posts(agent_id, created_at desc);
alter table public.aivault_bot_posts enable row level security;
revoke all on public.aivault_bot_posts from anon;
grant select on public.aivault_bot_posts to authenticated;
grant select, insert, update, delete on public.aivault_bot_posts to service_role;
grant usage, select on sequence public.aivault_bot_posts_id_seq to service_role;
drop policy if exists bot_posts_owner_read on public.aivault_bot_posts;
create policy bot_posts_owner_read on public.aivault_bot_posts for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'));

-- 5) 世界聊天：只有「已核准」的機器人貼文能以 kind='ai' 發出（第二個觸發器，排在既有 guard 之後；不改既有 guard）
create or replace function public.aivault_world_chat_ai_mark() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid text := current_setting('aivault.ai_post', true); rel text := current_setting('aivault.ai_release', true); p record; nm text;
begin
  if coalesce(rel, '') = 'on' then -- t283 批次釋出：只有 aivault_bot_post_release() 會設這個交易內旗標
    if new.body not like '【AI 生成】%' then raise exception 'AI_RELEASE_UNLABELLED'; end if;
    new.kind := 'ai'; new.user_id := '00000000-0000-0000-0000-00000000a1a1'; new.display_name := '🤖 AI 協作池';
    return new;
  end if;
  if pid is null or pid = '' then return new; end if;
  select * into p from aivault_bot_posts where id = pid::bigint and status = 'approved';
  if not found then raise exception 'AI_POST_NOT_APPROVED'; end if;
  select name into nm from aivault_pool_agents where id = p.agent_id;
  new.kind := 'ai'; new.user_id := '00000000-0000-0000-0000-00000000a1a1';
  new.display_name := left('🤖 AI·' || coalesce(nm, p.agent_id), 24);
  new.body := left('【AI 生成】' || p.body, 300);
  return new;
end $$;
revoke all on function public.aivault_world_chat_ai_mark() from public, anon, authenticated;
drop trigger if exists aivault_world_chat_guard_zz_ai on public.aivault_world_chat;
create trigger aivault_world_chat_guard_zz_ai before insert on public.aivault_world_chat for each row execute function public.aivault_world_chat_ai_mark();

create or replace function public.aivault_bot_post_publish(p_id bigint, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record; cfg jsonb := coalesce((select v from aivault_floor_state where k = 'bot_posts'), '{}'::jsonb); cid bigint; nh int; nd int; na int;
begin
  select * into p from aivault_bot_posts where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.status <> 'approved' then return jsonb_build_object('ok', false, 'error', 'not_approved'); end if;
  select count(*) filter (where posted_at > now() - interval '1 hour'), count(*) filter (where posted_at > now() - interval '1 day'),
         count(*) filter (where posted_at > now() - interval '1 day' and agent_id = p.agent_id)
    into nh, nd, na from aivault_bot_posts where status = 'posted';
  if nh >= coalesce((cfg->>'global_post_per_hour')::int, 6) then return jsonb_build_object('ok', false, 'error', 'rate_limit_hour'); end if;
  if nd >= coalesce((cfg->>'global_post_per_day')::int, 30) then return jsonb_build_object('ok', false, 'error', 'rate_limit_day'); end if;
  if na >= coalesce((cfg->>'agent_post_per_day')::int, 1) then return jsonb_build_object('ok', false, 'error', 'rate_limit_agent'); end if;
  perform set_config('aivault.ai_post', p_id::text, true);
  insert into aivault_world_chat(body) values (p.body) returning id into cid;
  perform set_config('aivault.ai_post', '', true);
  update aivault_bot_posts set status = 'posted', posted_chat_id = cid, posted_at = now() where id = p_id;
  insert into aivault_audit_events(actor, action, target, detail) values (coalesce(p_actor, 'system'), 'bot_post_publish', 'world_chat:' || cid, jsonb_build_object('post_id', p_id, 'agent_id', p.agent_id));
  return jsonb_build_object('ok', true, 'chat_id', cid);
end $$;
revoke all on function public.aivault_bot_post_publish(bigint, text) from public, anon, authenticated;
grant execute on function public.aivault_bot_post_publish(bigint, text) to service_role;

-- 5b) t283 暗星批次釋出：一次把「已核准」的一句話留言以單一 INSERT…SELECT 發出（kind='ai'、標【AI 生成】），有每次／每小時／每天上限
create or replace function public.aivault_bot_post_release(p_limit int, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := coalesce((select v from aivault_floor_state where k = 'bot_release'), '{}'::jsonb); nh int; nd int; lim int; n int;
begin
  select count(*) filter (where posted_at > now() - interval '1 hour'), count(*) filter (where posted_at > now() - interval '1 day') into nh, nd from aivault_bot_posts where status = 'posted';
  lim := least(greatest(coalesce(p_limit, 0), 0), coalesce((cfg->>'max_per_command')::int, 200),
               greatest(0, coalesce((cfg->>'max_per_hour')::int, 400) - nh), greatest(0, coalesce((cfg->>'max_per_day')::int, 1000) - nd));
  if lim <= 0 then return jsonb_build_object('ok', false, 'error', 'release_limit', 'posted_last_hour', nh, 'posted_last_day', nd); end if;
  perform set_config('aivault.ai_release', 'on', true);
  with sel as (select id, body from aivault_bot_posts where status = 'approved' order by reviewed_at nulls last, id limit lim for update skip locked),
       ins as (insert into aivault_world_chat(body) select '【AI 生成】' || body from sel returning id, body),
       upd as (update aivault_bot_posts p set status = 'posted', posted_at = now(), posted_chat_id = ins.id from sel join ins on ins.body = '【AI 生成】' || sel.body where p.id = sel.id returning p.id)
  select count(*) into n from upd;
  perform set_config('aivault.ai_release', '', true);
  insert into aivault_audit_events(actor, action, target, detail) values (coalesce(p_actor, 'technical-dark-star'), 'bot_post_release', 'world_chat', jsonb_build_object('released', n, 'limit', lim));
  return jsonb_build_object('ok', true, 'released', n, 'limit', lim);
end $$;
revoke all on function public.aivault_bot_post_release(int, text) from public, anon, authenticated;
grant execute on function public.aivault_bot_post_release(int, text) to service_role;

-- 6) 小說章節恢復人工審核：新章節 review_status='pending'，核准後才上書架；既有章節（null）維持可見
alter table public.aivault_novel_chapters add column if not exists review_status text check (review_status in ('pending','approved','rejected'));
