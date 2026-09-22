-- AIVAULT FlipBook ADD-only schema notes
-- Existing tables (DO NOT DROP / DO NOT RESET):
--   dark_star_ebooks
--   dark_star_ebook_pages
--   dark_star_ebook_toc
--   dark_star_ebook_reading_progress
--   dark_star_ebook_ingestion_jobs
--   dark_star_legal_sources
--
-- REST probe on 2026-09-23:
--   dark_star_ebook_bookmarks  -> table missing
--   dark_star_ebook_notes      -> table missing
--
-- First-phase bookmarks / notes / local search index live in IndexedDB
-- (aivault_flipbook_v1) so we do not invent a second Supabase project
-- and do not GRANT/DROP existing tables from the frontend.
--
-- Optional ADD (run only if Owner applies it in the current project).
-- These statements are IF NOT EXISTS and do not modify unrelated modules.

create table if not exists public.dark_star_ebook_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  book_id uuid,
  page_number int not null,
  title text,
  created_at timestamptz default now()
);

create table if not exists public.dark_star_ebook_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  book_id uuid,
  page_number int not null,
  note text,
  created_at timestamptz default now()
);

-- No GRANT / No RLS rewrite is applied from this frontend change.
-- dark-star-ebook-ingest already covers: create, append, finalize, status,
-- book, toc, context, progress.
