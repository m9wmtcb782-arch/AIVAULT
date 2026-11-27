create table if not exists public.ai_tax_simulation_records (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null default '稅務模擬紀錄' check (char_length(title) between 1 and 120),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ai_tax_simulation_records_user_created_idx on public.ai_tax_simulation_records (user_id, created_at desc);
alter table public.ai_tax_simulation_records enable row level security;
create policy ai_tax_simulation_records_select_own on public.ai_tax_simulation_records for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_tax_simulation_records_insert_own on public.ai_tax_simulation_records for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_tax_simulation_records_update_own on public.ai_tax_simulation_records for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_tax_simulation_records_delete_own on public.ai_tax_simulation_records for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
revoke all on public.ai_tax_simulation_records from anon;
grant select, insert, update, delete on public.ai_tax_simulation_records to authenticated;