-- vc1：共享影片學習中心（解碼一次、全城共用）。只新增表，不改舊表。
-- 復原：drop table if exists public.aivault_video_learning, public.aivault_video_access, public.aivault_video_segments, public.aivault_video_assets;
create table if not exists public.aivault_video_assets (
  id bigserial primary key, url text not null unique, title text, license text not null, author text, attribution text, source_page text,
  sha256 text, duration_s numeric, clip_start_s numeric default 0, clip_dur_s numeric, frame_every_s numeric,
  vision_model text, asr_model text, ocr_model text, per_frame_s numeric, status text not null default 'ready',
  created_at timestamptz not null default now());
create table if not exists public.aivault_video_segments (
  id bigserial primary key, asset_id bigint not null references public.aivault_video_assets(id) on delete cascade,
  t_s numeric not null, kind text not null default 'frame', -- frame | scene | asr
  caption text, ocr text, transcript text, model text, infer_ms int, created_at timestamptz not null default now());
create index if not exists aivault_video_segments_asset on public.aivault_video_segments(asset_id, t_s);
create table if not exists public.aivault_video_access (
  asset_id bigint not null references public.aivault_video_assets(id) on delete cascade, district text not null, primary key (asset_id, district));
create table if not exists public.aivault_video_learning (
  id bigserial primary key, asset_id bigint references public.aivault_video_assets(id) on delete set null, agent_id text,
  kind text not null, -- note | qa_eval | lab | exam
  payload jsonb not null default '{}'::jsonb, score numeric, model text, created_at timestamptz not null default now());
do $$ declare t text; begin
  foreach t in array array['aivault_video_assets','aivault_video_segments','aivault_video_access','aivault_video_learning'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop; end $$;
grant usage on sequence public.aivault_video_assets_id_seq, public.aivault_video_segments_id_seq, public.aivault_video_learning_id_seq to service_role;
