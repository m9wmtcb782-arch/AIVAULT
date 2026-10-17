-- 協作城公開版：城鎮動畫頁可公開讀取（只有動畫頁本身，不含名冊／任務內容），世界頻道、發號施令公告。
-- 1) 只有 agent-floor 動畫頁開放 anon 讀取（指揮台、協作池其他頁仍需登入）
grant select on public.aivault_private_pages to anon;
drop policy if exists aivault_private_pages_public_town on public.aivault_private_pages;
create policy aivault_private_pages_public_town on public.aivault_private_pages
  for select to anon using (slug = 'agent-floor');

-- 2) 世界頻道：任何人可讀；已登入且已核准的會員可發言；擁有者可刪
create table if not exists public.aivault_world_chat (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  display_name text not null default '',
  kind text not null default 'human' check (kind in ('human','ai','compute')),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists aivault_world_chat_created on public.aivault_world_chat(created_at desc);
alter table public.aivault_world_chat enable row level security;
revoke all on public.aivault_world_chat from anon, authenticated;
grant select on public.aivault_world_chat to anon, authenticated;
grant insert (body) on public.aivault_world_chat to authenticated;
grant delete on public.aivault_world_chat to authenticated;
grant usage, select on sequence public.aivault_world_chat_id_seq to authenticated;
drop policy if exists wc_read on public.aivault_world_chat;
create policy wc_read on public.aivault_world_chat for select to anon, authenticated using (true);
drop policy if exists wc_insert on public.aivault_world_chat;
create policy wc_insert on public.aivault_world_chat for insert to authenticated
  with check (user_id = auth.uid() and coalesce((auth.jwt()->'app_metadata'->>'approved')::boolean, true));
drop policy if exists wc_owner_delete on public.aivault_world_chat;
create policy wc_owner_delete on public.aivault_world_chat for delete to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('owner','admin'));

create or replace function public.aivault_world_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int; role text := auth.jwt()->'app_metadata'->>'role'; nm text;
begin
  new.user_id := auth.uid(); new.created_at := now(); new.kind := 'human';
  new.body := left(regexp_replace(btrim(new.body), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g'), 300);
  if new.body = '' then raise exception 'EMPTY'; end if;
  select count(*) filter (where created_at > now() - interval '15 seconds'), count(*) filter (where created_at > now() - interval '1 hour')
    into n1, n2 from public.aivault_world_chat where user_id = new.user_id;
  if n1 > 0 then raise exception 'RATE_LIMIT_15S'; end if;
  if n2 >= 40 then raise exception 'RATE_LIMIT_HOUR'; end if;
  nm := left(nullif(btrim(coalesce(auth.jwt()->'user_metadata'->>'name', auth.jwt()->'user_metadata'->>'full_name', '')), ''), 24);
  new.display_name := case when role = 'owner' then '👑 AIVAULT 擁有者' else coalesce(nm, 'AIVAULT 會員 ' || left(new.user_id::text, 4)) end;
  return new;
end $$;
drop trigger if exists aivault_world_chat_guard on public.aivault_world_chat;
create trigger aivault_world_chat_guard before insert on public.aivault_world_chat for each row execute function public.aivault_world_chat_guard();

-- 3) 發號施令：只經 edge function（擁有者）寫入；公告內容公開可讀
create table if not exists public.aivault_floor_commands (
  id bigserial primary key,
  body text not null check (char_length(body) between 1 and 500),
  zone text, task_id uuid, created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.aivault_floor_commands enable row level security;
revoke all on public.aivault_floor_commands from anon, authenticated;
grant select (id, body, zone, created_at) on public.aivault_floor_commands to anon, authenticated;
drop policy if exists fc_read on public.aivault_floor_commands;
create policy fc_read on public.aivault_floor_commands for select to anon, authenticated using (true);

-- 4) 城鎮狀態（擁有者上線時間等），只經 service role
create table if not exists public.aivault_floor_state (k text primary key, v jsonb not null default '{}', updated_at timestamptz not null default now());
alter table public.aivault_floor_state enable row level security;
revoke all on public.aivault_floor_state from anon, authenticated;

-- 5) 真人在線（協作城人物）：本人只能寫自己的列；公開只讀暱稱／外觀種子／所在工坊／最後上線（不含 email、user_id）
create table if not exists public.aivault_presence (
  user_id uuid primary key default auth.uid(),
  display_name text not null default '',
  seed int not null default 0,
  workshop text not null default '' check (char_length(workshop) <= 16),
  avatar text not null default '' check (avatar ~ '^((man|woman|elder|child):[0-7])?$'),
  last_seen timestamptz not null default now()
);
alter table public.aivault_presence enable row level security;
revoke all on public.aivault_presence from anon, authenticated;
grant select (display_name, seed, workshop, avatar, last_seen) on public.aivault_presence to anon, authenticated;
grant select (user_id) on public.aivault_presence to authenticated;
grant insert (workshop, avatar), update (workshop, avatar, last_seen) on public.aivault_presence to authenticated;
drop policy if exists pr_read on public.aivault_presence;
create policy pr_read on public.aivault_presence for select to anon, authenticated using (true);
drop policy if exists pr_ins on public.aivault_presence;
create policy pr_ins on public.aivault_presence for insert to authenticated
  with check (user_id = auth.uid() and coalesce((auth.jwt()->'app_metadata'->>'approved')::boolean, true));
drop policy if exists pr_upd on public.aivault_presence;
create policy pr_upd on public.aivault_presence for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and coalesce((auth.jwt()->'app_metadata'->>'approved')::boolean, true));
create or replace function public.aivault_presence_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare role text := auth.jwt()->'app_metadata'->>'role'; nm text;
begin
  new.user_id := auth.uid(); new.last_seen := now();
  new.workshop := coalesce(substring(regexp_replace(coalesce(new.workshop,''), '[^a-z0-9]', '', 'g') from 1 for 16), '');
  nm := left(nullif(btrim(coalesce(auth.jwt()->'user_metadata'->>'name', auth.jwt()->'user_metadata'->>'full_name', '')), ''), 16);
  new.display_name := case when role = 'owner' then '👑 擁有者' else coalesce(nm, '會員 ' || left(new.user_id::text, 4)) end;
  new.seed := abs(hashtext(new.user_id::text)) % 100000;
  if tg_op = 'UPDATE' and (new.avatar is null or new.avatar = '') then new.avatar := old.avatar; end if;
  if coalesce(new.avatar,'') !~ '^((man|woman|elder|child):[0-7])?$' then new.avatar := ''; end if;
  return new;
end $$;
drop trigger if exists aivault_presence_guard on public.aivault_presence;
create trigger aivault_presence_guard before insert or update on public.aivault_presence for each row execute function public.aivault_presence_guard();
alter table public.aivault_presence add column if not exists avatar text not null default '';
