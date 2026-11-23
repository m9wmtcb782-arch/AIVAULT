-- 回滾：先還原封面欄位（見 /workspace/backup-darkstar-llm-20261123/covers/），再視需要移除欄位；bucket 需先清空物件（Storage API）再刪。
update public.dark_star_ebooks set cover_url = null, cover_storage_path = null where cover_source = 'grokbot-procedural';
alter table public.dark_star_ebooks drop column if exists cover_source;
-- delete from storage.buckets where id = 'novel-covers';  -- 只有在 bucket 已清空後手動執行
