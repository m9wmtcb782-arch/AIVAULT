-- 修正：service_role（edge function）對協作城／學歷表沒有權限（📯 召集 403）
grant usage on schema public to service_role;
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' and (tablename like 'aivault_floor%' or tablename like 'aivault_pool%' or tablename like 'aivault_world%' or tablename like 'aivault_presence%') loop
    execute format('grant select, insert, update, delete on public.%I to service_role', r.tablename);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;
