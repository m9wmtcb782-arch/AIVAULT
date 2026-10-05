-- AIVAULT annual democratic election schedule
-- First cycle anchor: 2026-10-05 00:00 Asia/Taipei.
-- The system advances the election cycle by exactly one year.
-- No election is created before the first annual due date.

create table if not exists public.aivault_election_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_number integer not null unique,
  cycle_key text not null unique,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.aivault_elections
  add column if not exists cycle_id uuid references public.aivault_election_cycles(id);

create unique index if not exists aivault_elections_cycle_scope_unique
on public.aivault_elections (
  cycle_id,
  election_type,
  coalesce(district_code, ''),
  coalesce(village_key, '')
);

create table if not exists public.aivault_election_schedule (
  id boolean primary key default true check (id = true),
  anchor_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  frequency text not null default 'yearly' check (frequency = 'yearly'),
  next_run_at timestamptz not null,
  active boolean not null default true,
  last_cycle_id uuid references public.aivault_election_cycles(id),
  updated_at timestamptz not null default now()
);

insert into public.aivault_election_schedule
  (id, anchor_at, timezone, frequency, next_run_at, active)
values
  (true,
   '2026-10-05 00:00:00+08',
   'Asia/Taipei',
   'yearly',
   '2027-10-05 00:00:00+08',
   true)
on conflict (id) do nothing;

create or replace function public.aivault_election_schedule_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.aivault_election_schedule%rowtype;
  v_cycle_id uuid;
  v_cycle_no integer;
  v_cycle_key text;
  v_run_at timestamptz;
  v_district text;
  v_village text;
  v_created_count integer := 0;
begin
  select * into cfg
  from public.aivault_election_schedule
  where id = true
  for update;

  if not found or not cfg.active then
    return jsonb_build_object('status','inactive');
  end if;

  if now() < cfg.next_run_at then
    return jsonb_build_object('status','not_due','next_run_at',cfg.next_run_at);
  end if;

  v_cycle_no := coalesce((select max(cycle_number) from public.aivault_election_cycles), 0) + 1;
  v_run_at := cfg.next_run_at;
  v_cycle_key := to_char(v_run_at at time zone cfg.timezone, 'YYYY') || '-ANNUAL';

  if exists (select 1 from public.aivault_election_cycles c where c.cycle_key = v_cycle_key) then
    update public.aivault_election_schedule
      set next_run_at = cfg.next_run_at + interval '1 year',
          updated_at = now()
      where id = true;
    return jsonb_build_object('status','already_created','cycle_key',v_cycle_key);
  end if;

  insert into public.aivault_election_cycles
    (cycle_number, cycle_key, scheduled_at, status)
  values
    (v_cycle_no, v_cycle_key, v_run_at, 'active')
  returning id into v_cycle_id;

  insert into public.aivault_elections
    (cycle_id, election_type, name, status, opens_at)
  values
    (v_cycle_id, 'mayor', 'AIVAULT 年度市長選舉 ' || v_cycle_key,
     'candidate_registration', v_run_at);
  v_created_count := v_created_count + 1;

  for v_district in
    select distinct district_code
    from public.aivault_taipei_agent_constituencies
    where district_code is not null
    order by district_code
  loop
    insert into public.aivault_elections
      (cycle_id, election_type, name, status, district_code, opens_at)
    values
      (v_cycle_id, 'councilor', 'AIVAULT ' || v_district || ' 區年度議員選舉 ' || v_cycle_key,
       'candidate_registration', v_district, v_run_at);
    v_created_count := v_created_count + 1;
  end loop;

  for v_village in
    select distinct neighborhood_key
    from public.aivault_taipei_agent_constituencies
    where neighborhood_key is not null
    order by neighborhood_key
  loop
    insert into public.aivault_elections
      (cycle_id, election_type, name, status, village_key, opens_at)
    values
      (v_cycle_id, 'village_head', 'AIVAULT ' || v_village || ' 年度里長選舉 ' || v_cycle_key,
       'candidate_registration', v_village, v_run_at);
    v_created_count := v_created_count + 1;
  end loop;

  update public.aivault_election_schedule
    set next_run_at = cfg.next_run_at + interval '1 year',
        last_cycle_id = v_cycle_id,
        updated_at = now()
    where id = true;

  return jsonb_build_object(
    'status','created',
    'cycle_id',v_cycle_id,
    'cycle_key',v_cycle_key,
    'elections_created',v_created_count,
    'next_run_at',cfg.next_run_at + interval '1 year'
  );
end;
$$;

revoke all on function public.aivault_election_schedule_tick() from public;
revoke all on function public.aivault_election_schedule_tick() from anon;
revoke all on function public.aivault_election_schedule_tick() from authenticated;

alter table public.aivault_election_cycles enable row level security;
alter table public.aivault_election_schedule enable row level security;

drop policy if exists "election_cycles_read_authenticated" on public.aivault_election_cycles;
create policy "election_cycles_read_authenticated"
on public.aivault_election_cycles
for select to authenticated
using (true);

drop policy if exists "election_schedule_read_authenticated" on public.aivault_election_schedule;
create policy "election_schedule_read_authenticated"
on public.aivault_election_schedule
for select to authenticated
using (true);

select cron.unschedule('aivault-annual-election-scheduler')
where exists (select 1 from cron.job where jobname = 'aivault-annual-election-scheduler');

select cron.schedule(
  'aivault-annual-election-scheduler',
  '5 16 * * *',
  $$select public.aivault_election_schedule_tick();$$
);