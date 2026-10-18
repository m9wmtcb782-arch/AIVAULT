-- cm3b：交接檢視修正：同一 correlation 內有多張交接時，accept/reject 以 reply_to 對應那一張、report 以「接手者本人」對應，不再混用。
create or replace view public.aivault_comm_handoffs as
  select h.id handoff_id, h.correlation_id, h.project_id, h.sender, h.recipient, h.payload->>'goal' goal, h.created_at,
    (select min(a.id) from public.aivault_comm_messages a where a.reply_to=h.id and a.message_type='accept') accept_id,
    (select min(a.id) from public.aivault_comm_messages a where a.reply_to=h.id and a.message_type='reject') reject_id,
    (select max(a.id) from public.aivault_comm_messages a where a.correlation_id=h.correlation_id and a.message_type='report' and a.sender=h.recipient and a.id>h.id) report_id,
    (select (case when r.payload ? 'tests' and length(r.payload->>'tests')>2 then 1 else 0 end)+(case when r.payload ? 'cost' then 1 else 0 end)+(case when r.payload ? 'commits' then 1 else 0 end)+(case when length(coalesce(r.payload->>'missing',''))>0 then 1 else 0 end)
       from public.aivault_comm_messages r where r.correlation_id=h.correlation_id and r.message_type='report' and r.sender=h.recipient and r.id>h.id order by r.id desc limit 1) report_quality
  from public.aivault_comm_messages h where h.message_type='handoff';
revoke all on public.aivault_comm_handoffs from anon, authenticated; grant select on public.aivault_comm_handoffs to service_role;
