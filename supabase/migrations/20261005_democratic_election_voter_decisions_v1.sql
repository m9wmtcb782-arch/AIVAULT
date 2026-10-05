-- AIVAULT democratic election voter decision audit
-- Additive only. Does not start an election or assign elected offices.

create table if not exists public.aivault_election_voter_decisions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.aivault_elections(id) on delete cascade,
  voter_agent_id text not null references public.agent_registry(agent_id),
  selected_candidate_id uuid references public.aivault_election_candidates(id),
  decision_summary text,
  status text not null default 'decided' check (status in ('pending','decided','invalid','failed')),
  runtime_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(election_id,voter_agent_id)
);

create index if not exists idx_aivault_election_voter_decisions_election
  on public.aivault_election_voter_decisions(election_id);

alter table public.aivault_election_voter_decisions enable row level security;
revoke all on public.aivault_election_voter_decisions from anon, authenticated;
grant select on public.aivault_election_voter_decisions to service_role;
