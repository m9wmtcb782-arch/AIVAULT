-- Enforce a single linear evidence version chain and valid sequential version numbers.
create unique index if not exists tax_audit_evidence_single_successor_uidx
  on public.tax_audit_evidence (supersedes_evidence_id)
  where supersedes_evidence_id is not null;

create or replace function public.validate_tax_audit_evidence_lineage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prior_version integer;
  prior_dataset uuid;
begin
  if new.supersedes_evidence_id is null then
    if new.version_number <> 1 then
      raise exception 'Initial evidence record must use version 1.';
    end if;
    return new;
  end if;

  select version_number, dataset_id
    into prior_version, prior_dataset
    from public.tax_audit_evidence
    where id = new.supersedes_evidence_id
    for key share;

  if not found then
    raise exception 'Superseded evidence record does not exist.';
  end if;
  if new.version_number <> prior_version + 1 then
    raise exception 'Evidence version must increment the prior version by exactly one.';
  end if;
  if new.dataset_id is distinct from prior_dataset then
    raise exception 'Evidence versions must remain attached to the same dataset.';
  end if;
  if coalesce(btrim(new.supersession_reason), '') = '' then
    raise exception 'A supersession reason is required for revised evidence.';
  end if;
  return new;
end;
$$;

drop trigger if exists tax_audit_evidence_validate_lineage on public.tax_audit_evidence;
create trigger tax_audit_evidence_validate_lineage
  before insert on public.tax_audit_evidence
  for each row execute function public.validate_tax_audit_evidence_lineage();

-- A review correction must point to an earlier review of the same evidence item.
create or replace function public.validate_tax_audit_evidence_review_chain()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prior_evidence uuid;
begin
  if new.previous_review_id is null then
    return new;
  end if;

  select evidence_id into prior_evidence
    from public.tax_audit_evidence_reviews
    where id = new.previous_review_id
    for key share;

  if not found or prior_evidence <> new.evidence_id then
    raise exception 'Previous review must exist and belong to the same evidence record.';
  end if;
  return new;
end;
$$;

drop trigger if exists tax_audit_evidence_reviews_validate_chain
  on public.tax_audit_evidence_reviews;
create trigger tax_audit_evidence_reviews_validate_chain
  before insert on public.tax_audit_evidence_reviews
  for each row execute function public.validate_tax_audit_evidence_review_chain();
