-- t318：創辦人核准 8 本已核准 AI 小說改為公開。
-- 原因：aivault_sync_novel_ebook 每次章節同步都以 metadata||excluded.metadata 重新寫入 private:true（visibilityOf 取最嚴格 → 仍是 members）。
-- 做法（只加不刪）：新增 BEFORE 觸發器——AI 小說列的 visibility 已是 public 時，移除 metadata.private；不改同步函式、不影響其他書。
create or replace function public.aivault_ai_novel_public_strip_private() returns trigger language plpgsql set search_path = public as $$
begin
  if new.metadata->>'source' = 'ai-novel-pipeline' and new.visibility = 'public' and new.metadata ? 'private' then
    new.metadata := new.metadata - 'private';
  end if; return new; end $$;
drop trigger if exists aivault_ai_novel_public_zz on public.dark_star_ebooks;
create trigger aivault_ai_novel_public_zz before insert or update on public.dark_star_ebooks for each row execute function public.aivault_ai_novel_public_strip_private();
update public.dark_star_ebooks e set visibility = 'public'
from public.aivault_novel_books b
where b.id = e.id and b.approved and e.metadata->>'source' = 'ai-novel-pipeline'
  and e.id in ('bf7927aa-4da2-4697-84d8-326dd900b79d','c5a8a914-4e0f-426f-a81e-bad021b5cde4','36cfae81-2149-41d0-afd9-8520df504e81','9d6c6eb2-4be2-4466-a26f-4a499ecceb18','42d9ad61-f4ab-4c38-aec8-4efb6467c0c2','b18378c0-91c9-433d-8640-1de7066ed340','fcd413e3-28a4-4533-bf1e-e191b4258e2e','108e496a-b1db-4f79-b73e-663c565ae856');
