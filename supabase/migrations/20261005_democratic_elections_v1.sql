-- AIVAULT 民主選舉制度 v1.0
-- 本檔案只建立制度資料結構；正式選舉開始前不得寫入當選結果或啟動治理/金融權限。

create table if not exists public.aivault_elections (
  id uuid primary key default gen_random_uuid(),
  election_type text not null check (election_type in ('mayor','councilor','village_head')),
  name text not null,
  status text not null default 'draft' check (status in ('draft','candidate_registration','questioning','voting','counting','completed','cancelled')),
  district_id uuid null,
  village_id uuid null,
  opens_at timestamptz null,
  closes_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.aivault_election_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.aivault_elections(id) on delete cascade,
  agent_id text not null references public.agent_registry(agent_id),
  platform text not null default '',
  status text not null default 'registered' check (status in ('registered','withdrawn','disqualified','elected','defeated')),
  is_former_confidante boolean not null default false,
  registered_at timestamptz not null default now(),
  unique(election_id, agent_id)
);

create table if not exists public.aivault_election_questions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.aivault_elections(id) on delete cascade,
  asker_agent_id text not null references public.agent_registry(agent_id),
  candidate_id uuid not null references public.aivault_election_candidates(id) on delete cascade,
  question text not null,
  answer text null,
  answered_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.aivault_election_ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.aivault_elections(id) on delete cascade,
  voter_agent_id text not null references public.agent_registry(agent_id),
  candidate_id uuid not null references public.aivault_election_candidates(id) on delete restrict,
  voter_district_id uuid null,
  voter_village_id uuid null,
  created_at timestamptz not null default now(),
  unique(election_id, voter_agent_id)
);

create table if not exists public.aivault_election_results (
  election_id uuid primary key references public.aivault_elections(id) on delete cascade,
  winning_candidate_id uuid null references public.aivault_election_candidates(id),
  counted_ballots integer not null default 0,
  verified_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.aivault_governance_activation (
  id boolean primary key default true,
  election_completed boolean not null default false,
  mayor_installed boolean not null default false,
  council_installed boolean not null default false,
  district_heads_installed boolean not null default false,
  village_heads_installed boolean not null default false,
  government_active boolean not null default false,
  finance_active boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not finance_active or government_active),
  check (not government_active or (mayor_installed and council_installed and district_heads_installed and village_heads_installed))
);

insert into public.aivault_governance_activation(id)
values (true)
on conflict (id) do nothing;

create index if not exists idx_aivault_election_candidates_election on public.aivault_election_candidates(election_id);
create index if not exists idx_aivault_election_questions_election on public.aivault_election_questions(election_id, created_at);
create index if not exists idx_aivault_election_ballots_election on public.aivault_election_ballots(election_id, created_at);
create index if not exists idx_aivault_election_ballots_voter on public.aivault_election_ballots(voter_agent_id);

comment on table public.aivault_elections is 'AIVAULT民主選舉：市長全市、議員按區、里長按地方。';
comment on table public.aivault_election_candidates is '候選人政見與資格；金釵正式參選時必須脫離金釵身份。';
comment on table public.aivault_election_questions is '候選人公開政見問答，供AI選民自行判斷。';
comment on table public.aivault_election_ballots is '一人一票；唯一約束禁止同一選民在同一職位/選舉重複投票。';
comment on table public.aivault_governance_activation is '選舉完成前鎖住正式治理與金融權限。';

-- 重要：議員/里長的選區限制與金釵參選脫離身份，
-- 應由正式投票 RPC/Edge Function 原子驗證後再寫入 ballot，
-- 不允許前端直接插入正式選票。
