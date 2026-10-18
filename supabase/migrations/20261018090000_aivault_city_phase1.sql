-- city1：自主 AI 城市第一期（只新增表與欄位，不刪不改既有資料）。復原：drop 下列新表；alter table aivault_lab_experiments drop column sandbox, verifier_id, acceptor, cost_usd, artifact_kind;
create table if not exists public.aivault_sandboxes (key text primary key, name text not null, lo int not null, hi int not null, runtime text, status text not null default 'NOT VERIFIED', limits jsonb not null default '{}'::jsonb, note text);
insert into public.aivault_sandboxes(key,name,lo,hi,runtime,status,limits) values
 ('code','程式',1,120,'node20 offline docker','CONFIRMED','{"mem_mb":256,"cpu":1,"timeout_s":20,"net":false}'),
 ('game','遊戲',121,240,'node20 offline docker + iframe sandbox','REQUIRES TEST','{"mem_mb":256,"cpu":1,"timeout_s":20,"net":false}'),
 ('3d','3D',241,360,'node20 offline docker + three.js GLTFExporter + gltf-validator','REQUIRES TEST','{"mem_mb":512,"cpu":1,"timeout_s":40,"net":false}'),
 ('av','影音',361,440,null,'NOT VERIFIED','{}'),('music','音樂',441,500,null,'NOT VERIFIED','{}'),('tts','語音TTS',501,560,null,'NOT VERIFIED','{}'),
 ('image','圖像',561,620,null,'NOT VERIFIED','{}'),('reason','推理',621,720,null,'NOT VERIFIED','{}'),('model','模型研發',721,800,null,'NOT VERIFIED','{}'),
 ('gpu','GPU',801,880,null,'BLOCKED','{"note":"無免費 GPU；WebGPU 只能在使用者裝置測"}'),('collab','協作',881,940,null,'NOT VERIFIED','{}'),('security','安全驗收',941,1000,null,'NOT VERIFIED','{}')
on conflict (key) do nothing;
-- 邏輯編號對應真實代理（不建立新身分；ag-NNNN 的 NNNN 就是邏輯編號，原本的區域與角色不變）
create or replace view public.aivault_sandbox_members as
 select s.key sandbox, s.name, a.id agent_id, (regexp_replace(a.id,'\D','','g'))::int logical_no, a.domain original_domain
 from public.aivault_pool_agents a join public.aivault_sandboxes s on (regexp_replace(a.id,'\D','','g'))::int between s.lo and s.hi;
alter table public.aivault_lab_experiments add column if not exists sandbox text default 'code', add column if not exists verifier_id text, add column if not exists acceptor text, add column if not exists cost_usd numeric not null default 0, add column if not exists artifact_kind text default 'js';
-- 代理狀態機（RUNNING 只在真的執行時；不改 aivault_pool_agents）
create table if not exists public.aivault_agent_state (agent_id text primary key references public.aivault_pool_agents(id) on delete cascade, state text not null default 'READY' check (state in ('REGISTERED','READY','RUNNING','WAITING','SLEEPING','BLOCKED','RETIRED')), reason text, since timestamptz not null default now());
create table if not exists public.aivault_agent_lineage (agent_id text primary key, parent_id text, generation int not null default 0, template_version text, created_at timestamptz not null default now());
create table if not exists public.aivault_audit_events (id bigserial primary key, actor text, action text not null, target text, detail jsonb, created_at timestamptz not null default now());
create table if not exists public.aivault_replication_proposals (id bigserial primary key, parent_id text not null, reason text, status text not null default 'proposed', decided_by text, created_at timestamptz not null default now(), decided_at timestamptz);
create table if not exists public.aivault_help_requests (id bigserial primary key, lab_id bigint, requester text, helpers text[], status text not null default 'open', result text, verified_by text, created_at timestamptz not null default now(), closed_at timestamptz);
create table if not exists public.aivault_kb (id bigserial primary key, sha256 text unique, agent_id text, title text, summary text not null, source text, verified boolean not null default false, lab_id bigint, created_at timestamptz not null default now(), tsv tsvector generated always as (to_tsvector('simple', coalesce(title,'')||' '||summary)) stored);
create index if not exists aivault_kb_tsv on public.aivault_kb using gin(tsv);
-- 10 萬上限寫在資料庫（lineage 列數）
create or replace function public.aivault_lineage_cap() returns trigger language plpgsql as $$ begin if (select count(*) from public.aivault_agent_lineage) >= 100000 then raise exception 'agent cap 100000 reached'; end if; return new; end $$;
drop trigger if exists aivault_lineage_cap on public.aivault_agent_lineage; create trigger aivault_lineage_cap before insert on public.aivault_agent_lineage for each row execute function public.aivault_lineage_cap();
insert into public.aivault_agent_lineage(agent_id,generation,template_version) select id,0,'v1' from public.aivault_pool_agents on conflict do nothing;
insert into public.aivault_agent_state(agent_id,state,reason) select id,'READY','初始' from public.aivault_pool_agents on conflict do nothing;
insert into public.aivault_floor_state(k,v) values ('replication:off','{"off":"1"}') on conflict (k) do nothing;
do $$ declare t text; begin foreach t in array array['aivault_sandboxes','aivault_agent_state','aivault_agent_lineage','aivault_audit_events','aivault_replication_proposals','aivault_help_requests','aivault_kb'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); execute format('grant all on public.%I to service_role', t); end loop; end $$;
revoke all on public.aivault_sandbox_members from anon, authenticated; grant select on public.aivault_sandbox_members to service_role;
grant usage on all sequences in schema public to service_role;
