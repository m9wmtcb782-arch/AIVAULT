-- Preserve each node UUID and existing task ownership; allow many nodes per account.
-- No per-account device count quota is introduced.
BEGIN;
CREATE INDEX IF NOT EXISTS aivault_compute_nodes_user_id_idx
  ON public.aivault_compute_nodes (user_id);
DROP INDEX IF EXISTS public.aivault_compute_nodes_user_id_unique;
COMMIT;
