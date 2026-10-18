# 唯讀學歷稽核：每個查詢都在 read only 交易內執行，資料庫拒絕任何寫入。輸出 degree-audit.json（artifact）。
import json, os, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]; OUT={}
def sql(q):
    q="begin transaction read only; "+q.rstrip("; ")+";"
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/database/query"%REF,data=json.dumps({"query":q}).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+TOKEN,"User-Agent":"audit"},method="POST")
    try:
        with urllib.request.urlopen(r,timeout=300) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e: return {"error":e.code,"body":e.read()[:400].decode("utf-8","replace")}
def run(k,q): OUT[k]=sql(q); print(k, (len(OUT[k]) if isinstance(OUT[k],list) else OUT[k]))
T=["aivault_pool_agents","aivault_pool_agent_degree","aivault_pool_exam_answers","aivault_pool_exams","aivault_pool_agent_learning","aivault_pool_peer_reviews","aivault_lab_experiments","aivault_pool_special","aivault_special_degree","aivault_special_exam_answers","aivault_special_learning","aivault_agent_state","aivault_agent_lineage","aivault_pool_agent_tasks","aivault_kb","aivault_help_requests","aivault_pool_book_reads","aivault_roster_map"]
run("columns","select table_name,string_agg(column_name||':'||data_type,', ' order by ordinal_position) cols from information_schema.columns where table_schema='public' and table_name like any(array['aivault_pool%','aivault_special%','aivault_lab%','aivault_agent_%','aivault_kb%','aivault_help%','aivault_roster%','aivault_comm_%']) group by 1")
run("counts","select "+", ".join("(select count(*) from public.%s) %s"%(t,t) for t in T[:13]))
try: run("city_counts","select public.aivault_city_counts() c")
except Exception as e: OUT["city_counts"]=str(e)
run("agents","select id,name,domain,status,created_at,parent_agent_id,spawned from public.aivault_pool_agents order by created_at")
run("agents_extra","select id,name,created_at from public.aivault_pool_agents where id !~ '^ag-\\d+$' order by created_at")
run("lineage_summary","select generation,count(*),min(created_at),max(created_at),count(*) filter (where revoked_at is null) live from public.aivault_agent_lineage group by 1")
run("lineage_not_in_agents","select l.* from public.aivault_agent_lineage l left join public.aivault_pool_agents a on a.id=l.agent_id where a.id is null limit 50")
run("state_not_in_lineage","select s.agent_id,s.state from public.aivault_agent_state s left join public.aivault_agent_lineage l on l.agent_id=s.agent_id where l.agent_id is null limit 50")
run("degree","select agent_id,district,tier,level,placed_at,last_exam_at,updated_at,jsonb_array_length(history) hn,left(history::text,600) h from public.aivault_pool_agent_degree")
run("answers","select id,exam_id,agent_id,score,max_score,tier,level,grader,model,jsonb_array_length(qids) nq,jsonb_array_length(notes_used) nn,usage,left(grader_notes,200) gn,created_at from public.aivault_pool_exam_answers")
run("exams","select id,district,kind,created_by,opens_at,closes_at,jsonb_array_length(questions) nq,created_at from public.aivault_pool_exams")
run("learning_agg","select agent_id,count(*) n,count(*) filter (where http_status between 200 and 299) ok,count(*) filter (where coalesce(bytes,0)>0) withbytes,count(distinct sha256) dsha,count(distinct url) durl,count(*) filter (where length(notes)<40) shortnotes,count(*) filter (where fetched_at>created_at+interval '1 minute') future_fetch,min(created_at) first,max(created_at) last,count(*) filter (where url ilike '%mock%' or url ilike '%example.com%' or url like 'about:%') mockurl,count(*) filter (where lab_id is not null) labbed from public.aivault_pool_agent_learning group by 1")
run("lab","select id,day,kind,title,lead_id,tester_id,status,tokens,length(product_js) pl,length(test_js) tl,md5(coalesce(product_js,'')) pmd5,jsonb_array_length(iterations) it,left(iterations::text,300) itx,created_at,finished_at,ranks from public.aivault_lab_experiments")
run("peer","select reviewer_id,verdict,count(*) from public.aivault_pool_peer_reviews group by 1,2")
run("tasks_cols_sample","select * from public.aivault_pool_agent_tasks limit 1")
run("special","select * from public.aivault_pool_special")
run("special_degree","select agent_id,district,tier,level,placed_at,last_exam_at,jsonb_array_length(history) hn,left(history::text,800) h from public.aivault_special_degree")
run("special_answers","select id,exam_id,agent_id,score,max_score,tier,level,grader,model,created_at from public.aivault_special_exam_answers")
run("special_learning","select agent_id,count(*) n,count(*) filter (where http_status between 200 and 299) ok,min(created_at),max(created_at) from public.aivault_special_learning group by 1")
run("kb_by_agent","select agent_id,count(*) n,count(*) filter (where verified) v from public.aivault_kb group by 1")
run("book_reads","select * from public.aivault_pool_book_readers limit 0")
run("pop_cols","select table_name,string_agg(column_name||':'||data_type,', ' order by ordinal_position) cols from information_schema.columns where table_schema='public' and table_name in ('aivault_collaboration_pool_members','aivault_agent_social_rankings','agent_registry','aivault_roster_map') group by 1")
run("members_rows","select to_jsonb(m) r from public.aivault_collaboration_pool_members m")
run("rank_rows","select to_jsonb(r) - 'stats' r from public.aivault_agent_social_rankings r")
run("registry_rows","select to_jsonb(g) r from public.agent_registry g")
run("roster_map","select * from public.aivault_roster_map")
run("state_counts","select state,left(reason,40) reason,count(*) from public.aivault_agent_state group by 1,2")
run("leased_now","select count(distinct agent_id) from public.aivault_comm_deliveries where status='leased' and lease_until>now()")
run("cron","select jobname,schedule,left(command,600) cmd from cron.job")
run("rep_funcs","select proname,left(prosrc,3000) src from pg_proc where proname ilike '%replic%' or proname ilike '%spawn%'")
json.dump(OUT,open("degree-audit.json","w"),ensure_ascii=False,default=str)
