-- 已核准成果（供 AIVAULT 其他工具／企劃讀取；沿用底層表 RLS：只有 owner/admin 看得到）
create or replace view public.aivault_pool_approved_outputs with (security_invoker = true) as
select t.id, t.agent_id, a.name as agent_name, t.zone, t.order_text as task, t.result,
       t.steps->0->>'model' as model, t.steps->0->'usage' as usage, t.steps->0->>'source_url' as source_url,
       t.review_comment, t.reviewed_at, t.created_at
from public.aivault_pool_agent_tasks t left join public.aivault_pool_agents a on a.id = t.agent_id
where t.source = 'floor' and t.kind = 'work' and t.review_status = 'approved';
revoke all on public.aivault_pool_approved_outputs from anon;
grant select on public.aivault_pool_approved_outputs to authenticated, service_role;
