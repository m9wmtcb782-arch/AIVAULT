-- 神經訊號匯流排共用契約（兩個基地相同）。ADDITIVE ONLY，NOT APPLIED — 需開創者批准。
-- 不對任何既有表掛 trigger；neural_attach(table) 只在被明確呼叫時才掛。
BEGIN;
CREATE TABLE IF NOT EXISTS public.neural_events (
  id bigserial PRIMARY KEY,
  v smallint NOT NULL DEFAULT 1,
  ts timestamptz NOT NULL DEFAULT now(),
  base text NOT NULL CHECK (base IN ('base1','base2')),
  program text NOT NULL,          -- 檔案路徑或函式名
  organ text NOT NULL CHECK (organ IN ('sensory','motor','memory','reflex','cortex')),
  kind text NOT NULL,             -- page_view / user_action / edge_response / edge_error / ci_run / row_insert / outcome …
  session text,
  outcome text CHECK (outcome IN ('pass','fail') OR outcome IS NULL),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb   -- 不放個資、輸入內容或金鑰
);
CREATE INDEX IF NOT EXISTS neural_events_prog_idx ON public.neural_events (program, ts DESC);
CREATE INDEX IF NOT EXISTS neural_events_kind_idx ON public.neural_events (kind, ts DESC);
CREATE OR REPLACE FUNCTION public.neural_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'neural_events is append-only'; END $$;
DROP TRIGGER IF EXISTS neural_events_no_mutate ON public.neural_events;
CREATE TRIGGER neural_events_no_mutate BEFORE UPDATE OR DELETE ON public.neural_events FOR EACH ROW EXECUTE FUNCTION public.neural_events_append_only();
ALTER TABLE public.neural_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.neural_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.neural_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.neural_events_id_seq TO service_role;
-- 記憶器官：表的新增列 → 訊號（只在開創者對某表呼叫 neural_attach 時才生效）
CREATE OR REPLACE FUNCTION public.neural_row_signal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.neural_events(base, program, organ, kind, payload) VALUES (coalesce(current_setting('app.neural_base', true), 'base1'), TG_TABLE_NAME, 'memory', 'row_' || lower(TG_OP), jsonb_build_object('id', to_jsonb(NEW)->'id')); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.neural_attach(p_table regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE format('DROP TRIGGER IF EXISTS neural_signal ON %s; CREATE TRIGGER neural_signal AFTER INSERT ON %s FOR EACH ROW EXECUTE FUNCTION public.neural_row_signal()', p_table, p_table); END $$;
REVOKE ALL ON FUNCTION public.neural_attach(regclass) FROM PUBLIC, anon, authenticated;
COMMIT;
