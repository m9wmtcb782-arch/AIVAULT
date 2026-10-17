-- 協作池「1000 人工作區」：10 區 × 100 人、擁有者審核佇列、複製提案（只加欄位，不改既有資料）
alter table public.aivault_pool_agents add column if not exists zone text;
alter table public.aivault_pool_agents add column if not exists parent_agent_id text;
alter table public.aivault_pool_agents add column if not exists spawned boolean not null default false;
alter table public.aivault_pool_agent_tasks add column if not exists zone text;
alter table public.aivault_pool_agent_tasks add column if not exists kind text not null default 'work';
alter table public.aivault_pool_agent_tasks add column if not exists source text;
alter table public.aivault_pool_agent_tasks add column if not exists review_status text;
alter table public.aivault_pool_agent_tasks add column if not exists review_comment text;
alter table public.aivault_pool_agent_tasks add column if not exists reviewed_at timestamptz;
create index if not exists aivault_pool_agent_tasks_floor on public.aivault_pool_agent_tasks(source, status, created_at);
create index if not exists aivault_pool_agent_tasks_review on public.aivault_pool_agent_tasks(review_status, updated_at desc);
with r as (select id, domain, row_number() over (partition by domain order by id) n from public.aivault_pool_agents where not spawned)
update public.aivault_pool_agents a set zone = case
  when r.domain='coding' then 'code'
  when r.domain='research' or (r.domain='data' and r.n<=20) then 'research'
  when r.domain='law' or (r.domain='finance' and r.n<=10) then 'law'
  when r.domain='medicine' or (r.domain='education' and r.n<=20) then 'medicine'
  when r.domain='image' or (r.domain='writing' and r.n<=30) then 'image'
  when r.domain='video' or (r.domain='translation' and r.n<=40) then 'video'
  when r.domain='voice' or (r.domain='music' and r.n<=50) then 'voice'
  when r.domain in ('3d','education','music') then 'd3'
  when r.domain='marketing' or r.domain='writing' or (r.domain='finance' and r.n<=20) then 'market'
  else 'guard' end
from r where a.id=r.id and a.zone is null;
