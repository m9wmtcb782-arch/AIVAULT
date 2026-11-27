-- Evidence version lineage and immutable human review decisions.
-- No live database is changed by adding this migration to the PR branch.

alter table public.tax_audit_evidence
  add column if not exists version_number integer not null default 1
    check (version_number >= 1),
  add column if not exists supersedes_evidence_id uuid
    references public.tax_audit_evidence(id) on delete restrict,
  add column if not exists supersession_reason text;

alter table public.tax_audit_evidence
  add constraint tax_audit_evidence_not_self_superseding
  check (supersedes_evidence_id is null or supersedes_evidence_id <> id);

create unique index if not exists tax_audit_evidence_parent_version_uidx
  on public.tax_audit_evidence (supersedes_evidence_id, version_number)
  where supersedes_evidence_id is not null;

create index if not exists tax_audit_evidence_lineage_idx
  on public.tax_audit_evidence (id, supersedes_evidence_id, version_number);

create table if not exists public.tax_audit_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.tax_audit_evidence(id) on delete restrict,
  reviewer_id uuid not null default auth.uid() references auth.users(id),
  reviewer_label text not null check (char_length(reviewer_label) between 1 and 120),
  decision text not null check (decision in (
    'pending','confirmed','request_more_evidence','dismissed','referred'
  )),
  rationale text not null check (char_length(rationale) between 1 and 4000),
  reviewed_at timestamptz not null default now(),
  previous_review_id uuid references public.tax_audit_evidence_reviews(id) on delete restrict,
  review_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(review_metadata) = 'object')
);

create index if not exists tax_audit_evidence_reviews_evidence_time_idx
  on public.tax_audit_evidence_reviews (evidence_id, reviewed_at desc);

alter table public.tax_audit_evidence_reviews enable row level security;
revoke all on public.tax_audit_evidence_reviews from anon, authenticated;
grant select, insert on public.tax_audit_evidence_reviews to authenticated;

create policy tax_audit_evidence_reviews_select
  on public.tax_audit_evidence_reviews for select to authenticated
  using (public.is_tax_audit_member());

create policy tax_audit_evidence_reviews_insert
  on public.tax_audit_evidence_reviews for insert to authenticated
  with check (
    public.has_tax_audit_role(array['chief_auditor','reviewer'])
    and reviewer_id = (select auth.uid())
  );

create or replace function public.prevent_tax_audit_evidence_review_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Audit review decisions are append-only; submit a superseding review instead.';
end;
$$;

drop trigger if exists tax_audit_evidence_reviews_no_update
  on public.tax_audit_evidence_reviews;
create trigger tax_audit_evidence_reviews_no_update
  before update on public.tax_audit_evidence_reviews
  for each row execute function public.prevent_tax_audit_evidence_review_mutation();

drop trigger if exists tax_audit_evidence_reviews_no_delete
  on public.tax_audit_evidence_reviews;
create trigger tax_audit_evidence_reviews_no_delete
  before delete on public.tax_audit_evidence_reviews
  for each row execute function public.prevent_tax_audit_evidence_review_mutation();

comment on table public.tax_audit_evidence_reviews is
  'Append-only human review decisions for audit evidence; corrections are new linked review records.';
comment on column public.tax_audit_evidence.supersedes_evidence_id is
  'Prior evidence record replaced by this newly captured version; prior records are retained.';
