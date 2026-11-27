-- National tax audit workspace: aggregate public-finance data, findings and oversight trail.
-- Do not store individual taxpayer returns, IDs, bank accounts, or other taxpayer PII.

create table if not exists public.tax_audit_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('chief_auditor','auditor','reviewer','observer')),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id)
);
alter table public.tax_audit_memberships enable row level security;
revoke all on public.tax_audit_memberships from anon, authenticated;
grant all on public.tax_audit_memberships to service_role;

create or replace function public.is_tax_audit_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.tax_audit_memberships m where m.user_id = (select auth.uid()) and m.active = true); $$;

create or replace function public.has_tax_audit_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.tax_audit_memberships m where m.user_id = (select auth.uid()) and m.active = true and m.role = any(allowed_roles)); $$;

revoke all on function public.is_tax_audit_member() from public, anon;
revoke all on function public.has_tax_audit_role(text[]) from public, anon;
grant execute on function public.is_tax_audit_member() to authenticated;
grant execute on function public.has_tax_audit_role(text[]) to authenticated;

create table if not exists public.tax_audit_datasets (
 id uuid primary key default gen_random_uuid(),
 fiscal_year integer not null check (fiscal_year between 1900 and 2200),
 agency text not null check (char_length(agency) between 1 and 160),
 tax_type text not null check (char_length(tax_type) between 1 and 100),
 region_code text,
 budget_amount numeric(20,2), assessed_amount numeric(20,2), collected_amount numeric(20,2),
 refund_amount numeric(20,2), arrears_amount numeric(20,2),
 taxpayer_count bigint check (taxpayer_count is null or taxpayer_count >= 0),
 period_start date, period_end date,
 source_name text not null, source_url text, source_hash text not null,
 data_quality text not null default 'unverified' check (data_quality in ('unverified','validated','rejected')),
 metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
 imported_by uuid not null default auth.uid() references auth.users(id),
 imported_at timestamptz not null default now(),
 unique (fiscal_year, agency, tax_type, region_code, source_hash)
);
create index if not exists tax_audit_datasets_year_agency_idx on public.tax_audit_datasets (fiscal_year, agency, tax_type);
alter table public.tax_audit_datasets enable row level security;
create policy tax_audit_datasets_select on public.tax_audit_datasets for select to authenticated using (public.is_tax_audit_member());
create policy tax_audit_datasets_insert on public.tax_audit_datasets for insert to authenticated with check (public.has_tax_audit_role(array['chief_auditor','auditor']) and imported_by = (select auth.uid()));
create policy tax_audit_datasets_update on public.tax_audit_datasets for update to authenticated using (public.has_tax_audit_role(array['chief_auditor','auditor'])) with check (public.has_tax_audit_role(array['chief_auditor','auditor']));
create policy tax_audit_datasets_delete on public.tax_audit_datasets for delete to authenticated using (public.has_tax_audit_role(array['chief_auditor']));

create table if not exists public.tax_audit_runs (
 id uuid primary key default gen_random_uuid(),
 dataset_id uuid not null references public.tax_audit_datasets(id) on delete restrict,
 run_type text not null default 'rule_based' check (run_type in ('rule_based','scenario','cross_year','cross_agency','legal_compliance')),
 engine_version text not null,
 status text not null default 'queued' check (status in ('queued','running','completed','failed','review_required')),
 parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
 summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
 initiated_by uuid not null default auth.uid() references auth.users(id),
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists tax_audit_runs_dataset_created_idx on public.tax_audit_runs (dataset_id, created_at desc);
alter table public.tax_audit_runs enable row level security;
create policy tax_audit_runs_select on public.tax_audit_runs for select to authenticated using (public.is_tax_audit_member());
create policy tax_audit_runs_insert on public.tax_audit_runs for insert to authenticated with check (public.has_tax_audit_role(array['chief_auditor','auditor']) and initiated_by = (select auth.uid()));
create policy tax_audit_runs_update on public.tax_audit_runs for update to authenticated using (public.has_tax_audit_role(array['chief_auditor','auditor'])) with check (public.has_tax_audit_role(array['chief_auditor','auditor']));
create policy tax_audit_runs_delete on public.tax_audit_runs for delete to authenticated using (public.has_tax_audit_role(array['chief_auditor']));

create table if not exists public.tax_audit_findings (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.tax_audit_runs(id) on delete restrict,
 dataset_id uuid not null references public.tax_audit_datasets(id) on delete restrict,
 finding_code text, category text not null,
 severity text not null check (severity in ('info','low','medium','high','critical')),
 title text not null check (char_length(title) between 1 and 240),
 description text not null,
 evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
 recommendation text,
 status text not null default 'open' check (status in ('open','under_review','confirmed','dismissed','remediation','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tax_audit_findings_run_severity_idx on public.tax_audit_findings (run_id, severity, status);
alter table public.tax_audit_findings enable row level security;
create policy tax_audit_findings_select on public.tax_audit_findings for select to authenticated using (public.is_tax_audit_member());
create policy tax_audit_findings_insert on public.tax_audit_findings for insert to authenticated with check (public.has_tax_audit_role(array['chief_auditor','auditor']));
create policy tax_audit_findings_update on public.tax_audit_findings for update to authenticated using (public.has_tax_audit_role(array['chief_auditor','auditor','reviewer'])) with check (public.has_tax_audit_role(array['chief_auditor','auditor','reviewer']));
create policy tax_audit_findings_delete on public.tax_audit_findings for delete to authenticated using (public.has_tax_audit_role(array['chief_auditor']));

create table if not exists public.tax_audit_actions (
 id uuid primary key default gen_random_uuid(),
 finding_id uuid not null references public.tax_audit_findings(id) on delete restrict,
 action_type text not null check (action_type in ('investigate','request_data','recommendation','corrective_action','follow_up','closure')),
 description text not null, assigned_to uuid references auth.users(id), due_date date,
 status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','cancelled')),
 response text, created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tax_audit_actions_finding_idx on public.tax_audit_actions (finding_id, status);
alter table public.tax_audit_actions enable row level security;
create policy tax_audit_actions_select on public.tax_audit_actions for select to authenticated using (public.is_tax_audit_member());
create policy tax_audit_actions_insert on public.tax_audit_actions for insert to authenticated with check (public.has_tax_audit_role(array['chief_auditor','auditor']) and created_by = (select auth.uid()));
create policy tax_audit_actions_update on public.tax_audit_actions for update to authenticated using (public.has_tax_audit_role(array['chief_auditor','auditor','reviewer'])) with check (public.has_tax_audit_role(array['chief_auditor','auditor','reviewer']));
create policy tax_audit_actions_delete on public.tax_audit_actions for delete to authenticated using (public.has_tax_audit_role(array['chief_auditor']));

create table if not exists public.tax_audit_events (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null, entity_id uuid, event_type text not null,
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
 actor_id uuid not null default auth.uid() references auth.users(id),
 occurred_at timestamptz not null default now()
);
create index if not exists tax_audit_events_entity_time_idx on public.tax_audit_events (entity_type, entity_id, occurred_at desc);
alter table public.tax_audit_events enable row level security;
create policy tax_audit_events_select on public.tax_audit_events for select to authenticated using (public.is_tax_audit_member());
create policy tax_audit_events_insert on public.tax_audit_events for insert to authenticated with check (public.has_tax_audit_role(array['chief_auditor','auditor','reviewer']) and actor_id = (select auth.uid()));

revoke all on public.tax_audit_datasets, public.tax_audit_runs, public.tax_audit_findings, public.tax_audit_actions, public.tax_audit_events from anon;
grant select, insert, update, delete on public.tax_audit_datasets, public.tax_audit_runs, public.tax_audit_findings, public.tax_audit_actions, public.tax_audit_events to authenticated;
