-- Prevent exact duplicate ebook content from being finalized or listed.
-- Idempotent: this migration is safe after the column/index were applied manually.
alter table public.dark_star_ebooks
  add column if not exists content_sha256 text;

-- Backfill existing books from their stored page content using the same
-- NFKC + whitespace-collapsing canonicalization used by the Edge Function.
update public.dark_star_ebooks e
set content_sha256 = encode(
  digest(
    convert_to(
      normalize(
        btrim(regexp_replace(
          coalesce((
            select string_agg(p.content, '' order by p.page_number)
            from public.dark_star_ebook_pages p
            where p.ebook_id = e.id
          ), ''),
          E'\\s+', ' ', 'g'
        )),
        NFKC
      ),
      'UTF8'
    ),
    'sha256'
  ),
  'hex'
)
where e.content_sha256 is null
  and exists (
    select 1 from public.dark_star_ebook_pages p where p.ebook_id = e.id
  );

create unique index if not exists dark_star_ebooks_content_sha256_uidx
  on public.dark_star_ebooks(content_sha256)
  where content_sha256 is not null
    and status <> 'duplicate_blocked';
