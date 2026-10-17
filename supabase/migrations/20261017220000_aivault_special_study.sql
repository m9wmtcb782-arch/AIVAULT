-- sp1：暗星／曙光的學習與考試紀錄（結構同一般代理，但不放進代理表，避免被一般派工用其他模型冒名）
create table if not exists public.aivault_special_learning (like public.aivault_pool_agent_learning including all);
create table if not exists public.aivault_special_exam_answers (like public.aivault_pool_exam_answers including all);
create table if not exists public.aivault_special_degree (like public.aivault_pool_agent_degree including all);
create table if not exists public.aivault_special_memory (like public.aivault_pool_agent_memory including all);
do $$ declare t text; begin foreach t in array array['aivault_special_learning','aivault_special_exam_answers','aivault_special_degree','aivault_special_memory'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
end loop; end $$;
