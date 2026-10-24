-- Stage (c): nn-infer dispatch audit (additive). No new edge functions.
-- Does not modify Stage (a)/(b) assets. Free-tier safe.
BEGIN;

CREATE TABLE IF NOT EXISTS public.compute_nn_dispatch_log (
  id bigserial PRIMARY KEY,
  task_id text NOT NULL,
  model_id text NOT NULL DEFAULT 'owned-micro-mlp-v1',
  node_id text,
  status text NOT NULL,
  executed_on text,
  weights_sha256 text,
  logits_sha256 text,
  top1_agreement double precision,
  max_abs_error_vs_host double precision,
  llm_called boolean NOT NULL DEFAULT false,
  external_api boolean NOT NULL DEFAULT false,
  verified boolean,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compute_nn_dispatch_log_task_id_idx ON public.compute_nn_dispatch_log (task_id);
CREATE INDEX IF NOT EXISTS compute_nn_dispatch_log_created_at_idx ON public.compute_nn_dispatch_log (created_at DESC);

ALTER TABLE public.compute_nn_dispatch_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compute_nn_dispatch_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.compute_nn_dispatch_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.compute_nn_dispatch_log_id_seq TO service_role;

-- Best-effort registry approval if tables exist (Stage b attested model).
DO $$
BEGIN
  IF to_regclass('public.model_registry') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.model_registry (model_id, availability, is_simulated)
      VALUES ('owned-micro-mlp-v1', 'AVAILABLE', false)
      ON CONFLICT (model_id) DO UPDATE
        SET availability = 'AVAILABLE', is_simulated = false;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      RAISE NOTICE 'model_registry schema differs; skip insert';
    END;
  END IF;
  IF to_regclass('aivault_compute_security.model_access') IS NOT NULL THEN
    BEGIN
      INSERT INTO aivault_compute_security.model_access
        (model_id, ownership, approved_for_pool, inference_test_passed)
      VALUES ('owned-micro-mlp-v1', 'first_party', true, true)
      ON CONFLICT (model_id) DO UPDATE
        SET ownership = 'first_party',
            approved_for_pool = true,
            inference_test_passed = true,
            updated_at = now();
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'model_access upsert skipped: %', SQLERRM;
    END;
  END IF;
END $$;

COMMIT;
