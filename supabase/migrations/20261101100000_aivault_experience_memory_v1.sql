-- Experience memory v1 mirror (pgvector). ADDITIVE, NOT APPLIED — founder approval required.
-- 384-dim = Xenova/paraphrase-multilingual-MiniLM-L12-v2. Service-role only, append-only.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.aivault_experience_memory (
  id bigserial PRIMARY KEY,
  bank text NOT NULL CHECK (bank IN ('correct_experience','error_experience')),
  task_type text NOT NULL,
  question_norm text NOT NULL,
  qhash text NOT NULL,
  embedding vector(384) NOT NULL,
  answer jsonb,
  source_model text,
  evidence jsonb NOT NULL,
  score double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aivault_experience_memory_qhash_idx ON public.aivault_experience_memory (qhash);
CREATE INDEX IF NOT EXISTS aivault_experience_memory_vec_idx ON public.aivault_experience_memory USING hnsw (embedding vector_cosine_ops);
CREATE OR REPLACE FUNCTION public.aivault_experience_memory_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'aivault_experience_memory is append-only'; END $$;
DROP TRIGGER IF EXISTS aivault_experience_memory_no_mutate ON public.aivault_experience_memory;
CREATE TRIGGER aivault_experience_memory_no_mutate BEFORE UPDATE OR DELETE ON public.aivault_experience_memory
  FOR EACH ROW EXECUTE FUNCTION public.aivault_experience_memory_append_only();
ALTER TABLE public.aivault_experience_memory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aivault_experience_memory FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.aivault_experience_memory TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.aivault_experience_memory_id_seq TO service_role;
COMMIT;
