-- vc2：Gemini 免費層影片抽查計數器（每天上限，預設 20；遇 429 或計費相關錯誤當天自動停）。
-- 復原：drop function if exists public.aivault_video_spot_take(int); drop table if exists public.aivault_video_spot_usage;
create table if not exists public.aivault_video_spot_usage (day date primary key, n int not null default 0, blocked boolean not null default false, last_error text, updated_at timestamptz default now());
alter table public.aivault_video_spot_usage enable row level security; revoke all on public.aivault_video_spot_usage from anon, authenticated; grant all on public.aivault_video_spot_usage to service_role;
create or replace function public.aivault_video_spot_take(cap int) returns int language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Taipei')::date; r record;
begin
  insert into aivault_video_spot_usage(day) values (d) on conflict (day) do nothing;
  select * into r from aivault_video_spot_usage where day = d for update;
  if r.blocked or r.n >= cap then return -1; end if;
  update aivault_video_spot_usage set n = n + 1, updated_at = now() where day = d;
  return r.n + 1;
end $$;
revoke all on function public.aivault_video_spot_take(int) from public, anon, authenticated; grant execute on function public.aivault_video_spot_take(int) to service_role;
