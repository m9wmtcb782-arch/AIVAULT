-- ai1：協作池特殊成員（真正的暗星、曙光；不算在 1000 位代理內）。活動只由 technical-dark-star.html 真的回覆／說話／生成時回報。
create table if not exists public.aivault_pool_special (
  id text primary key, name text not null, kind text not null default 'core_ai',
  real_path text not null default '', activity text not null default '', last_at timestamptz, updated_at timestamptz not null default now());
alter table public.aivault_pool_special enable row level security;
revoke all on public.aivault_pool_special from anon, authenticated;
grant select, insert, update, delete on public.aivault_pool_special to service_role;
insert into public.aivault_pool_special(id,name,real_path) values
 ('darkstar','暗星','technical-dark-star.html → ai-gateway agent_id=technical-dark-star'),
 ('dawn-light','曙光','technical-dark-star.html → ai-gateway agent_id=dawn-light／dawn-light-* functions')
on conflict (id) do nothing;
