-- t314：小說封面 bucket（公開，只收 JPG）＋ dark_star_ebooks.cover_source 欄位（只加不刪）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('novel-covers', 'novel-covers', true, 3145728, array['image/jpeg']) on conflict (id) do nothing;
alter table public.dark_star_ebooks add column if not exists cover_source text; -- 'gemini'＝暗星 Gemini 正式封面；'grokbot-procedural'＝對照封面（可被 Gemini 取代，不滿足出版閘門）
