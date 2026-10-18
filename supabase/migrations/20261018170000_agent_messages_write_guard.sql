-- sec 10:06：agent_messages 移除「任何已登入者可讀寫」。保留讀；寫只給 service role、或 JWT app_metadata.role=owner/admin（含經由 SECURITY DEFINER 的 agent_module_send_message，因 auth.jwt() 仍是呼叫者的）。不刪資料。
-- 關閉守門（不建議）：insert into aivault_floor_state(k,v) values('amsg_guard:off','{"off":"1"}') on conflict (k) do update set v=excluded.v;
-- 完全回滾：drop trigger agent_messages_write_guard on public.agent_messages; drop policy agent_messages_auth_read on public.agent_messages; create policy agent_messages_auth_all on public.agent_messages for all to authenticated using (true) with check (true);
create or replace function public.agent_messages_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare j jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if j is null then return coalesce(new, old); end if;            -- 直接 SQL／cron／migration（沒有 API 請求）
  if j->>'role' = 'service_role' then return coalesce(new, old); end if;
  if coalesce(j->'app_metadata'->>'role','') in ('owner','admin') then return coalesce(new, old); end if;
  if exists (select 1 from aivault_floor_state where k='amsg_guard:off' and v->>'off'='1') then return coalesce(new, old); end if;
  raise exception 'agent_messages: write requires service role or owner/admin' using errcode='42501';
end $$;
drop trigger if exists agent_messages_write_guard on public.agent_messages;
create trigger agent_messages_write_guard before insert or update or delete on public.agent_messages for each row execute function public.agent_messages_guard();
drop policy if exists agent_messages_auth_all on public.agent_messages;
drop policy if exists agent_messages_auth_read on public.agent_messages;
create policy agent_messages_auth_read on public.agent_messages for select to authenticated using (true);
