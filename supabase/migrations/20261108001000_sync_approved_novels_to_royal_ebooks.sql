
CREATE OR REPLACE FUNCTION public.aivault_sync_novel_ebook(p_book_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $fn$
DECLARE b public.aivault_novel_books%ROWTYPE; page_total integer; char_total bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 8191));
 SELECT * INTO b FROM public.aivault_novel_books WHERE id=p_book_id;
 IF NOT FOUND OR NOT b.approved THEN
   DELETE FROM public.dark_star_ebooks WHERE id=p_book_id AND metadata->>'source'='ai-novel-pipeline';
   RETURN;
 END IF;
 SELECT count(*),coalesce(sum(length(text)),0) INTO page_total,char_total
 FROM public.aivault_novel_chapters WHERE book_id=p_book_id;
 IF page_total=0 THEN
 DELETE FROM public.dark_star_ebooks WHERE id=p_book_id AND metadata->>'source'='ai-novel-pipeline';
 RETURN;
 END IF;
 INSERT INTO public.dark_star_ebooks(id,title,subtitle,author,description,language,status,total_pages,total_characters,metadata)
 VALUES(b.id,b.title,b.genre||' · '||CASE WHEN b.status='done' THEN '完結' ELSE '連載中' END,
 'AIVAULT 協作池原創作者群',
 '開創者已核准的原創小說，依已完成章節持續連載。','zh-Hant','published',page_total,char_total,
 jsonb_build_object('source','ai-novel-pipeline','novel_id',b.id,'category','小說與文學','subcategory','AI 原創小說','genre',b.genre,'private',true,'fit_font',true,'page_mode','preserve_chunks','content_type','text'))
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle,
 description=excluded.description,status='published',total_pages=excluded.total_pages,
 total_characters=excluded.total_characters,metadata=public.dark_star_ebooks.metadata||excluded.metadata,updated_at=now()
 WHERE public.dark_star_ebooks.metadata->>'source'='ai-novel-pipeline';
 IF NOT EXISTS(SELECT 1 FROM public.dark_star_ebooks WHERE id=b.id AND metadata->>'source'='ai-novel-pipeline') THEN
   RAISE EXCEPTION 'Novel ebook identity collision';
 END IF;
 INSERT INTO public.dark_star_ebook_pages(ebook_id,page_number,title,content,word_count,metadata)
 SELECT b.id,row_number() OVER(ORDER BY c.ch)::integer,
 '第'||c.ch||'章 '||coalesce(c.title,''),c.text,length(c.text),
 jsonb_build_object('source','ai-novel-pipeline','novel_id',b.id,'novel_ch',c.ch,'agent_id',c.agent_id)
 FROM public.aivault_novel_chapters c WHERE c.book_id=b.id
 ON CONFLICT(ebook_id,page_number) DO UPDATE SET title=excluded.title,
 content=excluded.content,word_count=excluded.word_count,metadata=excluded.metadata;
 DELETE FROM public.dark_star_ebook_pages WHERE ebook_id=b.id AND page_number>page_total AND metadata->>'source'='ai-novel-pipeline';
 INSERT INTO public.dark_star_ebook_toc(ebook_id,ordinal,level,title,page_number,metadata)
 SELECT b.id,(row_number() OVER(ORDER BY c.ch)-1)::integer,'chapter',
 '第'||c.ch||'章 '||coalesce(c.title,''),(row_number() OVER(ORDER BY c.ch))::integer,
 jsonb_build_object('source','ai-novel-pipeline','novel_ch',c.ch)
 FROM public.aivault_novel_chapters c WHERE c.book_id=b.id
 ON CONFLICT(ebook_id,ordinal) DO UPDATE SET title=excluded.title,page_number=excluded.page_number,level=excluded.level,metadata=excluded.metadata;
 DELETE FROM public.dark_star_ebook_toc WHERE ebook_id=b.id AND ordinal>=page_total AND metadata->>'source'='ai-novel-pipeline';
END $fn$;
REVOKE ALL ON FUNCTION public.aivault_sync_novel_ebook(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aivault_sync_novel_ebook(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.aivault_novel_ebook_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $fn$
BEGIN
 IF TG_TABLE_NAME='aivault_novel_books' THEN
   IF TG_OP='DELETE' THEN PERFORM public.aivault_sync_novel_ebook(OLD.id);
   ELSE PERFORM public.aivault_sync_novel_ebook(NEW.id); END IF;
 ELSE
   IF TG_OP='DELETE' THEN PERFORM public.aivault_sync_novel_ebook(OLD.book_id);
   ELSE
     PERFORM public.aivault_sync_novel_ebook(NEW.book_id);
     IF TG_OP='UPDATE' AND OLD.book_id IS DISTINCT FROM NEW.book_id THEN
       PERFORM public.aivault_sync_novel_ebook(OLD.book_id);
     END IF;
   END IF;
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.aivault_novel_ebook_trigger() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aivault_novel_ebook_trigger() TO service_role;
CREATE TRIGGER aivault_novel_books_ebook_sync
 AFTER INSERT OR UPDATE OR DELETE ON public.aivault_novel_books
 FOR EACH ROW EXECUTE FUNCTION public.aivault_novel_ebook_trigger();
CREATE TRIGGER aivault_novel_chapters_ebook_sync
 AFTER INSERT OR UPDATE OR DELETE ON public.aivault_novel_chapters
 FOR EACH ROW EXECUTE FUNCTION public.aivault_novel_ebook_trigger();
SELECT public.aivault_sync_novel_ebook(id) FROM public.aivault_novel_books WHERE approved;
