BEGIN;
-- Only backend service_role receives the permissions used by the existing authenticated mesh handler.
-- No anon/authenticated grants, no DELETE rights, and no RLS changes.
GRANT SELECT, INSERT, UPDATE ON public.aivault_compute_nodes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.aivault_compute_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.aivault_compute_results TO service_role;
GRANT INSERT ON public.aivault_compute_node_events TO service_role;
COMMIT;
