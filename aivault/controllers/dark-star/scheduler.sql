-- Bounded persistent trigger for base-001. 144 calls/day. No model by default.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
-- Deploy after runtime function exists:
-- select cron.schedule('aivault-dark-star-bounded-tick','*/10 * * * *',
--  $job$select net.http_post(
--   url:='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-dark-star-runtime',
--   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||<scheduler_token>),
--   body:='{"action":"run_once"}'::jsonb,timeout_milliseconds:=50000
--  );$job$);
