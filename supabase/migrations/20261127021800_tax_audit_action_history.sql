-- Append-only history for corrective-action assignment, status and response changes.
-- This migration is committed to the PR only; it does not alter the live Supabase project.

create table if not exists public.tax_audit_action_history (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.tax_audit_actions(id) on delete restrict,
  event_type text not null check (event_type in ('created','updated')),
  old_status text,
  new_status text not null check (new_status in ('pending','in_progress','blocked','completed','cancelled')),
  old_due_date date,
  new_due_date date,
  old_assigned_to uuid references auth.users(id),
  new_assigned_to uuid references auth.users(id),
  old_response text,
  new_response text,
  actor_id uuid not null default auth.uid() references auth.users(id),
  occurred_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists tax_audit_action_history_action_time_idx
  on public.tax_audit_action_history (action_id, occurred_at desc);

alter table public.tax_audit_action_history enable row level security;
revoke all on public.tax_audit_action_history from anon, authenticated;
grant select on public.tax_audit_action_history to authenticated;

create policy tax_audit_action_history_select
  on public.tax_audit_action_history for select to authenticated
  using (public.is_tax_audit_member());

create or replace function public.prevent_tax_audit_action_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Corrective action history is append-only.';
end;
$$;

drop trigger if exists tax_audit_action_history_no_update
  on public.tax_audit_action_history;
create trigger tax_audit_action_history_no_update
  before update on public.tax_audit_action_history
  for each row execute function public.prevent_tax_audit_action_history_mutation();

drop trigger if exists tax_audit_action_history_no_delete
  on public.tax_audit_action_history;
create trigger tax_audit_action_history_no_delete
  before delete on public.tax_audit_action_history
  for each row execute function public.prevent_tax_audit_action_history_mutation();

create or replace function public.record_tax_audit_action_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tax_audit_action_history (
      action_id,event_type,new_status,new_due_date,new_assigned_to,
      new_response,actor_id,snapshot
    ) values (
      new.id,'created',new.status,new.due_date,new.assigned_to,
      new.response,coalesce(auth.uid(),new.created_by),
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
      coalesce(auth.uid(),new.created_by),
      jsonb_build_object('description',new.description,'action_type',new.action_type)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tax_audit_actions_history_insert_update
  on public.tax_audit_actions;
create trigger tax_audit_actions_history_insert_update
  after insert or update on public.tax_audit_actions
  for each row execute function public.record_tax_audit_action_history();

comment on table public.tax_audit_action_history is
  'Append-only audit trail for corrective action assignment, due date, status and response changes.';
