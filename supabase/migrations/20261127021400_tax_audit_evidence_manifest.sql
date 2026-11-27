-- Append-only audit evidence manifest. This stores metadata and hashes, not the uploaded file bytes.
-- A SHA-256 digest does not authenticate the source or prove the truth of the data.
-- This is application-level append-only protection, not WORM storage against database owners.

create table if not exists public.tax_audit_evidence (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.tax_audit_datasets(id) on delete restrict,
  run_id uuid references public.tax_audit_runs(id) on delete restrict,
  original_filename text not null check (char_length(original_filename) between 1 and 512),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  content_type text,
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  hash_algorithm text not null default 'SHA-256' check (hash_algorithm = 'SHA-256'),
  source_name text,
  source_url text,
  source_authenticity text not null default 'not_verified'
    check (source_authenticity in ('not_verified','official_source_checked','rejected')),
  source_published_at timestamptz,
  file_last_modified_at timestamptz,
  captured_at timestamptz not null default now(),
  captured_by uuid not null default auth.uid() references auth.users(id),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists tax_audit_evidence_dataset_created_idx
  on public.tax_audit_evidence (dataset_id, created_at desc);
create index if not exists tax_audit_evidence_sha256_idx
  on public.tax_audit_evidence (sha256);

alter table public.tax_audit_evidence enable row level security;
revoke all on public.tax_audit_evidence from anon, authenticated;
grant select, insert on public.tax_audit_evidence to authenticated;

create policy tax_audit_evidence_select
  on public.tax_audit_evidence for select to authenticated
  using (public.is_tax_audit_member());

create policy tax_audit_evidence_insert
  on public.tax_audit_evidence for insert to authenticated
  with check (
    public.has_tax_audit_role(array['chief_auditor','auditor'])
    and captured_by = (select auth.uid())
  );

-- Prevent ordinary application roles from changing or deleting captured evidence records.
create or replace function public.prevent_tax_audit_evidence_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Audit evidence manifests are append-only; create a superseding record instead.';
end;
$$;

drop trigger if exists tax_audit_evidence_no_update on public.tax_audit_evidence;
create trigger tax_audit_evidence_no_update
  before update on public.tax_audit_evidence
  for each row execute function public.prevent_tax_audit_evidence_mutation();

drop trigger if exists tax_audit_evidence_no_delete on public.tax_audit_evidence;
create trigger tax_audit_evidence_no_delete
  before delete on public.tax_audit_evidence
  for each row execute function public.prevent_tax_audit_evidence_mutation();

comment on table public.tax_audit_evidence is
  'Append-only metadata and SHA-256 manifests for national tax audit evidence; original file bytes are not stored here.';
comment on column public.tax_audit_evidence.sha256 is
  'Lowercase SHA-256 digest of the exact file bytes; proves content identity only, not source authenticity.';
