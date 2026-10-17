-- rm1：方案 A 名冊合併（不刪任何列）。復原：drop table aivault_roster_map; alter table agent_registry drop column roster_status, drop column duplicate_of;
-- 快照備份（同庫）：backup_20261017_* 表
create table if not exists public.backup_20261017_agent_registry as select * from public.agent_registry;
create table if not exists public.backup_20261017_aivault_ai_avatars as select * from public.aivault_ai_avatars;
create table if not exists public.backup_20261017_aivault_agent_cognitive_models as select * from public.aivault_agent_cognitive_models;
create table if not exists public.backup_20261017_aivault_agent_social_rankings as select * from public.aivault_agent_social_rankings;
create table if not exists public.backup_20261017_aivault_pool_special as select * from public.aivault_pool_special;
do $$ declare t text; begin foreach t in array array['backup_20261017_agent_registry','backup_20261017_aivault_ai_avatars','backup_20261017_aivault_agent_cognitive_models','backup_20261017_aivault_agent_social_rankings','backup_20261017_aivault_pool_special'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); end loop; end $$;
alter table public.agent_registry add column if not exists roster_status text, add column if not exists duplicate_of text;
create table if not exists public.aivault_roster_map (registry_id text primary key, pool_kind text not null, pool_id text, note text, created_at timestamptz not null default now());
alter table public.aivault_roster_map enable row level security; revoke all on public.aivault_roster_map from anon, authenticated; grant all on public.aivault_roster_map to service_role;
insert into public.aivault_roster_map(registry_id,pool_kind,pool_id,note) values
 ('darkstar','special','darkstar','暗星（真實路徑 ai-gateway technical-dark-star）'),
 ('technical-dark-star','special','darkstar','暗星別名（同名 Technical Dark Star）'),
 ('dawn-light','special','dawn-light','曙光（真實路徑 ai-gateway dawn-light）')
on conflict (registry_id) do nothing;
update public.agent_registry set roster_status='active-special' where agent_id in ('darkstar','dawn-light') and roster_status is null;
update public.agent_registry set roster_status='alias', duplicate_of='darkstar' where agent_id='technical-dark-star' and roster_status is null;
update public.agent_registry set roster_status='simulated-duplicate', duplicate_of=replace(agent_id,'Worker-sim-','Worker-') where agent_id like 'Worker-sim-%' and roster_status is null;
update public.agent_registry set roster_status='registered-inactive' where roster_status is null;
