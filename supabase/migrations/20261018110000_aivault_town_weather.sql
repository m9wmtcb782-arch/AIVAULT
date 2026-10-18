-- ss1：小鎮真實天氣快照（只有一列 id=1）。排程寫入（town-weather.yml，service 經 Management API），任何人可讀。
-- 回滾：drop table public.aivault_town_weather;（小鎮會自動改回日期推算的模擬天氣）
create table if not exists public.aivault_town_weather (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.aivault_town_weather enable row level security;
revoke all on public.aivault_town_weather from anon, authenticated;
grant select on public.aivault_town_weather to anon, authenticated;
drop policy if exists tw_read on public.aivault_town_weather;
create policy tw_read on public.aivault_town_weather for select to anon, authenticated using (true);
