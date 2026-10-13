-- Shared electronic-book library, read-only retrieval; no table/policy changes.
create or replace function public.dark_star_search_ebook_pages(
  terms text[], book_id uuid default null, result_limit integer default 6
) returns table(page_id uuid, ebook_id uuid, book_title text, page_number integer,
  chapter text, section text, excerpt text, score integer)
language sql stable security invoker set search_path = public
as $$
  with keywords as (
    select distinct lower(left(trim(t),80)) term
    from unnest(terms[1:24]) t where length(trim(t)) between 2 and 80
  ), ranked as (
    select p.id, p.ebook_id, b.title book_title, p.page_number, p.chapter, p.section,
      p.content, sum(case when strpos(lower(p.content),k.term)>0 then length(k.term) else 0 end
        + case when strpos(lower(coalesce(p.title,'')||' '||coalesce(p.chapter,'')||' '||coalesce(p.section,'')),k.term)>0 then 3 else 0 end)::integer score,
      min(nullif(strpos(lower(p.content),k.term),0)) first_match
    from public.dark_star_ebook_pages p join public.dark_star_ebooks b on b.id=p.ebook_id
    cross join keywords k
    where (book_id is null or p.ebook_id=book_id) and coalesce(p.content,'')<>''
    group by p.id,p.ebook_id,b.title,p.page_number,p.chapter,p.section,p.content
  )
  select id,ebook_id,book_title,page_number,chapter,section,
    substring(content from greatest(1,coalesce(first_match,1)-600) for 5000),score
  from ranked where score>0 order by score desc,ebook_id,page_number
  limit greatest(1,least(coalesce(result_limit,6),10));
$$;
revoke all on function public.dark_star_search_ebook_pages(text[],uuid,integer) from public, anon, authenticated;
grant execute on function public.dark_star_search_ebook_pages(text[],uuid,integer) to service_role;
