-- pb3：每本協作池書的真實讀者數（從學習紀錄 url='poolbook:<id>#ch<n>' 計算，不另存、不估算）＋最新讀者
create or replace function public.aivault_pool_book_readers()
returns table(book_id text, readers bigint, reads bigint, last_agent text, last_at timestamptz) language sql stable security definer set search_path=public as $$
  with x as (select split_part(substr(url,10),'#',1) b, agent_id, created_at from public.aivault_pool_agent_learning where url like 'poolbook:%')
  select b, count(distinct agent_id), count(*), (array_agg(agent_id order by created_at desc))[1], max(created_at) from x group by b $$;
grant execute on function public.aivault_pool_book_readers() to anon, authenticated, service_role;
create index if not exists aivault_pool_agent_learning_poolbook_idx on public.aivault_pool_agent_learning(url) where url like 'poolbook:%';
notify pgrst, 'reload schema';
