-- Harden national tax audit authorization and preserve review/action evidence.
-- This migration is intentionally additive. It does not edit or rewrite prior migrations.
-- Apply only to an isolated local/test database until separately reviewed and authorized.

-- SECURITY DEFINER membership helpers must not resolve objects through a mutable search_path.
create or replace function public.is_tax_audit_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tax_audit_memberships m
    where m.user_id = (select auth.uid())
      and m.active = true
  );
$$;

create or replace function public.has_tax_audit_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tax_audit_memberships m
    where m.user_id = (select auth.uid())
      and m.active = true
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_tax_audit_member() from public, anon;
revoke all on function public.has_tax_audit_role(text[]) from public, anon;
grant execute on function public.is_tax_audit_member() to authenticated;
grant execute on function public.has_tax_audit_role(text[]) to authenticated;

-- Revoke broad table-level DML. Re-grant only the operations/columns required by
-- the role matrix; RLS policies remain the row-level authorization boundary.
revoke all on public.tax_audit_memberships,
  public.tax_audit_datasets,
  public.tax_audit_runs,
  public.tax_audit_findings,
  public.tax_audit_actions,
  public.tax_audit_events,
  public.tax_audit_evidence,
  public.tax_audit_evidence_reviews,
  public.tax_audit_action_history
from anon, authenticated;

-- Membership administration remains service_role-only. No authenticated user
-- can promote themselves or grant roles through the Data API.
grant all on public.tax_audit_memberships to service_role;

-- All active audit members can read workspace records. Only explicitly granted
-- columns can be modified; RLS continues to constrain which rows/roles.
grant select, insert on public.tax_audit_datasets to authenticated;
grant update (data_quality, metadata) on public.tax_audit_datasets to authenticated;

grant select, insert on public.tax_audit_runs to authenticated;
grant update (status, summary, started_at, completed_at) on public.tax_audit_runs to authenticated;

grant select, insert on public.tax_audit_findings to authenticated;
grant update (status, recommendation, description) on public.tax_audit_findings to authenticated;

grant select, insert on public.tax_audit_actions to authenticated;
grant update (assigned_to, due_date, status, response) on public.tax_audit_actions to authenticated;

grant select, insert on public.tax_audit_events to authenticated;
grant select, insert on public.tax_audit_evidence to authenticated;
grant select, insert on public.tax_audit_evidence_reviews to authenticated;
grant select on public.tax_audit_action_history to authenticated;

-- Reviewers submit immutable review decisions; they must not rewrite the
-- underlying finding text or reassign/change corrective actions.
drop policy if exists tax_audit_findings_update on public.tax_audit_findings;
create policy tax_audit_findings_update
  on public.tax_audit_findings for update to authenticated
  using (public.has_tax_audit_role(array['chief_auditor','auditor']))
  with check (public.has_tax_audit_role(array['chief_auditor','auditor']));

drop policy if exists tax_audit_actions_update on public.tax_audit_actions;
create policy tax_audit_actions_update
  on public.tax_audit_actions for update to authenticated
  using (public.has_tax_audit_role(array['chief_auditor','auditor']))
  with check (public.has_tax_audit_role(array['chief_auditor','auditor']));

-- Keep append-only history trigger function out of the public execute surface
-- and harden its name resolution. Trigger execution still occurs as function owner.
create or replace function public.record_tax_audit_action_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tax_audit_action_history (
      action_id,event_type,new_status,new_due_date,new_assigned_to,
      new_response,actor_id,snapshot
    ) values (
      new.id,'created',new.status,new.due_date,new.assigned_to,
      new.response,coalesce((select auth.uid()),new.created_by),
      jsonb_build_object('description',new.description,'action_type',new.action_type)
    );
    return new;
  end if;

  if row(new.status,new.due_date,new.assigned_to,new.response)
     is distinct from
     row(old.status,old.due_date,old.assigned_to,old.response) then
    insert into public.tax_audit_action_history (
      action_id,event_type,old_status,new_status,old_due_date,new_due_date,
      old_assigned_to,new_assigned_to,old_response,new_response,actor_id,snapshot
    ) values (
      new.id,'updated',old.status,new.status,old.due_date,new.due_date,
      old.assigned_to,new.assigned_to,old.response,new.response,
      coalesce((select auth.uid()),new.created_by),
      jsonb_build_object('description',new.description,'action_type',new.action_type)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.record_tax_audit_action_history() from public, anon, authenticated;

-- Trigger functions should not be directly callable by API roles.
revoke all on function public.prevent_tax_audit_evidence_mutation() from public, anon, authenticated;
revoke all on function public.prevent_tax_audit_evidence_review_mutation() from public, anon, authenticated;
revoke all on function public.prevent_tax_audit_action_history_mutation() from public, anon, authenticated;
revoke all on function public.validate_tax_audit_evidence_lineage() from public, anon, authenticated;
revoke all on function public.validate_tax_audit_evidence_review_chain() from public, anon, authenticated;

-- Normalize the search path of every trigger function. These functions are
-- invoked by database triggers, not directly by API callers; an empty path
-- prevents accidental resolution through objects in public.
alter function public.prevent_tax_audit_evidence_mutation() set search_path = '';
alter function public.prevent_tax_audit_evidence_review_mutation() set search_path = '';
alter function public.prevent_tax_audit_action_history_mutation() set search_path = '';
alter function public.validate_tax_audit_evidence_lineage() set search_path = '';
alter function public.validate_tax_audit_evidence_review_chain() set search_path = '';
alter function public.record_tax_audit_action_history() set search_path = '';

-- Explicitly document that application roles cannot delete or rewrite evidence,
-- reviews, event records, or action history. Database owners remain privileged.
comment on table public.tax_audit_events is
  'Append-only audit event stream. API roles have SELECT/INSERT only; privileged database owners remain outside this protection.';
comment on table public.tax_audit_evidence_reviews is
  'Append-only human review decisions. Corrections must be new linked review rows.';
comment on table public.tax_audit_action_history is
  'Trigger-generated append-only corrective-action history. API roles have SELECT only.';
