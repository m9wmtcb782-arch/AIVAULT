BEGIN;
CREATE SCHEMA IF NOT EXISTS aivault_compute_security;
REVOKE ALL ON SCHEMA aivault_compute_security FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS aivault_compute_security.model_access (
  model_id text PRIMARY KEY REFERENCES public.model_registry(model_id),
  ownership text NOT NULL CHECK (ownership IN ('first_party','external')),
  approved_for_pool boolean NOT NULL DEFAULT false,
  inference_test_passed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE aivault_compute_security.model_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aivault_compute_security.model_access FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA aivault_compute_security TO service_role;
GRANT ALL ON aivault_compute_security.model_access TO service_role;
INSERT INTO aivault_compute_security.model_access (model_id,ownership)
SELECT model_id,'first_party' FROM public.model_registry
WHERE model_id IN ('planned-extract','planned-reasoning','planned-coding','planned-vision','planned-verify')
ON CONFLICT (model_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.aivault_check_pool_model_access(p_model_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT EXISTS (
   SELECT 1 FROM aivault_compute_security.model_access a
   JOIN public.model_registry r ON r.model_id = a.model_id
   WHERE a.model_id = p_model_id AND a.ownership = 'first_party'
     AND a.approved_for_pool AND a.inference_test_passed
     AND r.availability = 'AVAILABLE' AND r.is_simulated = false
 );
$fn$;
REVOKE ALL ON FUNCTION public.aivault_check_pool_model_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aivault_check_pool_model_access(text) TO service_role;
COMMIT;
