create table public.aivault_darkstar_crossbase_receipts (
 source_comment_id bigint primary key,
 source_sha256 text not null,
 task_id text references public.agent_tasks(task_id),
 status text not null check(status in ('PROCESSING','READY','SENDING','SENT','BLOCKED','UNKNOWN')),
 request_id text, model text, response_text text,
 target_comment_id bigint, usage jsonb, error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.aivault_darkstar_crossbase_receipts enable row level security;
revoke all on public.aivault_darkstar_crossbase_receipts from public,anon,authenticated;
grant select,insert,update on public.aivault_darkstar_crossbase_receipts to service_role;