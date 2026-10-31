-- Causal Engine v0 (不二過). ADDITIVE ONLY. NOT APPLIED — requires founder approval.
-- Does not alter any existing table/function. Service-role only (RLS on, no policies for anon/authenticated).
BEGIN;
CREATE TABLE IF NOT EXISTS public.aivault_causal_events (
  id bigserial PRIMARY KEY,
  agent_id text,
  district text,
  task_type text NOT NULL,
  input_hash text NOT NULL,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('pass','fail')),
  error_class text CHECK (error_class IN ('rate_limit_429','quality_fail','timeout','parse_error','other')),
  root_cause text,
  lesson text,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aivault_causal_events_task_idx ON public.aivault_causal_events (task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS aivault_causal_events_hash_idx ON public.aivault_causal_events (input_hash);
-- append-only: block UPDATE/DELETE even for service role
CREATE OR REPLACE FUNCTION public.aivault_causal_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'aivault_causal_events is append-only'; END $$;
DROP TRIGGER IF EXISTS aivault_causal_events_no_mutate ON public.aivault_causal_events;
CREATE TRIGGER aivault_causal_events_no_mutate BEFORE UPDATE OR DELETE ON public.aivault_causal_events
  FOR EACH ROW EXECUTE FUNCTION public.aivault_causal_events_append_only();
ALTER TABLE public.aivault_causal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aivault_causal_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.aivault_causal_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.aivault_causal_events_id_seq TO service_role;

CREATE OR REPLACE VIEW public.aivault_causal_lessons WITH (security_invoker = true) AS
SELECT task_type, error_class, lesson,
       count(*) AS occurrences, max(created_at) AS last_seen
FROM public.aivault_causal_events
WHERE outcome = 'fail' AND lesson IS NOT NULL
GROUP BY task_type, error_class, lesson;
REVOKE ALL ON public.aivault_causal_lessons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aivault_causal_lessons TO service_role;
COMMIT;
