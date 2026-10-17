-- vd1：學習紀錄來源類型（web｜video_subtitles）、字幕語言、逐字稿字數
alter table public.aivault_pool_agent_learning add column if not exists source_type text not null default 'web';
alter table public.aivault_pool_agent_learning add column if not exists caption_lang text;
alter table public.aivault_pool_agent_learning add column if not exists transcript_chars int;
