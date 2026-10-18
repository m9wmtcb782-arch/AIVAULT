-- cm3：標準交接協定（handoff）。每位代理交辦工作都用同一格式；接手者 accept/reject；最後 report 用同一 correlation_id 回報。只增不改。
alter table public.aivault_comm_messages drop constraint if exists aivault_comm_messages_message_type_check;
alter table public.aivault_comm_messages add constraint aivault_comm_messages_message_type_check check (message_type in ('help_request','delegate','accept','reject','progress','deliver','test_failed','fix_request','accepted','admin_command','info','handoff','report'));
create index if not exists aivault_comm_messages_type_corr on public.aivault_comm_messages(message_type, correlation_id);
-- 格式驗證（在送訊前，由 trigger 執行；不合格直接拒收）
create or replace function public.aivault_comm_handoff_check() returns trigger language plpgsql as $$
declare k text; par record; begin
  if new.message_type='handoff' then
    foreach k in array array['goal','context','owned_scope','forbidden_scope','constraints','success_criteria','report_format'] loop
      if not (new.payload ? k) or coalesce(length(new.payload->>k),0) < 2 then raise exception 'handoff missing field: %', k; end if; end loop;
    if position('free' in lower(new.payload->>'constraints'))=0 and position('免費' in (new.payload->>'constraints'))=0 then raise exception 'handoff constraints must state free-only'; end if;
    if position('privilege' in lower(new.payload->>'constraints'))=0 and position('權限' in (new.payload->>'constraints'))=0 then raise exception 'handoff constraints must forbid privilege escalation'; end if;
    if new.recipient_kind not in ('dm','group') then raise exception 'handoff must be dm or group'; end if;
  elsif new.message_type in ('accept','reject','report') and new.reply_to is not null then
    select message_type, correlation_id into par from public.aivault_comm_messages where id=new.reply_to;
    if new.message_type='report' then
      if not exists (select 1 from public.aivault_comm_messages where correlation_id=new.correlation_id and message_type='handoff') then raise exception 'report must share correlation_id with a handoff'; end if;
      foreach k in array array['done','missing','changes','tests','failures','cost','commits'] loop if not (new.payload ? k) then raise exception 'report missing field: %', k; end if; end loop;
    end if;
  elsif new.message_type='report' then raise exception 'report must reply_to the handoff or its accept';
  end if; return new; end $$;
drop trigger if exists aivault_comm_handoff_check on public.aivault_comm_messages;
create trigger aivault_comm_handoff_check before insert on public.aivault_comm_messages for each row execute function public.aivault_comm_handoff_check();
-- 每個交接一列：誰交給誰、接了沒、回報沒、回報有沒有附測試與費用（協作考核分數來源）
create or replace view public.aivault_comm_handoffs as
  select h.id handoff_id, h.correlation_id, h.project_id, h.sender, h.recipient, h.payload->>'goal' goal, h.created_at,
    (select min(id) from public.aivault_comm_messages a where a.correlation_id=h.correlation_id and a.message_type='accept') accept_id,
    (select min(id) from public.aivault_comm_messages a where a.correlation_id=h.correlation_id and a.message_type='reject') reject_id,
    (select max(id) from public.aivault_comm_messages a where a.correlation_id=h.correlation_id and a.message_type='report') report_id,
    (select (case when r.payload ? 'tests' and length(r.payload->>'tests')>2 then 1 else 0 end)+(case when r.payload ? 'cost' then 1 else 0 end)+(case when r.payload ? 'commits' then 1 else 0 end)+(case when length(coalesce(r.payload->>'missing',''))>0 then 1 else 0 end) from public.aivault_comm_messages r where r.correlation_id=h.correlation_id and r.message_type='report' order by id desc limit 1) report_quality
  from public.aivault_comm_messages h where h.message_type='handoff';
revoke all on public.aivault_comm_handoffs from anon, authenticated; grant select on public.aivault_comm_handoffs to service_role;
insert into public.aivault_kb(sha256,agent_id,title,summary,source,verified) values (encode(sha256(convert_to('handoff-protocol-v1','UTF8')),'hex'),'owner','交接協定 handoff v1（全體代理必用）',
 '交辦工作一律送 message_type=handoff，payload 必填：goal（目標）、context（背景與來源連結／訊息 id）、owned_scope（你可以改的檔案／分支）、forbidden_scope（不准碰的東西）、constraints（只用免費資源、不得提升權限、不得自我核准）、success_criteria（怎樣算完成、要過哪些測試）、report_format（done/missing/changes/tests/failures/cost/commits）。接手者用 reply_to 回 accept 或 reject（附理由）。完成後回 report（同一 correlation_id），欄位 done、missing、changes、tests、failures、cost、commits，不能造假，沒做到的寫在 missing。',
 'owner-order-2026-10-18',true) on conflict (sha256) do nothing;
