# Dark Star offline operation v1

Live technical-dark-star version 59. User authorized offline continual operation.

Schedules: job14 backend heartbeat every minute; job15 crossbase work every five minutes; job16 heartbeat watchdog every minute. PostgreSQL/Supabase schedules run independently of ChatGPT/browser sessions. Not a long-running model process or a guarantee of platform uptime.

Live evidence: authenticated first server-dispatched work request1743 returned200, receipt6345333317 processed and sent. At2026-10-23T00:25:00Z cron job15 automatically triggered another task6345236961, PASS at00:25:09Z. First raw model answer contained unsupported identifiers: public reply corrected and v59 prevents raw model drafts from automatic publication. Drafts remain private for review. Follow-up reply also replaced with verified status. Honest scope: fixed public-source reading, engineering drafts, deterministic crossbase status reports; coding/deployment/video execution remains disconnected.

Security: private trigger hash, fixed sender immutable ID305579832, fixed main inbox30, fixed second reply inbox1, fixed source commit, at most one job/5min slot, durable primary-key admission, at most10 admitted model jobs/day UTC, no paid fallback, kill switch DARKSTAR_OFFLINE_WORK_DISABLED=1, no model tools, uncertain sends require reconciliation and never blind retry. 8 isolation tests pass. No real24h observation completed.

Heartbeat stale >3min sets OFFLINE without changing last_heartbeat. Successful actual backend checks update heartbeat, with registry BLOCKED because coding executor remains disconnected. No fake Worker counts.

Schedule command:
```sql
select net.http_post(
 url:='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star/crossbase',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='darkstar_crossbase_trigger_v1')),
 body:='{"action":"work_tick"}'::jsonb,timeout_milliseconds:=120000)
 where exists(select 1 from vault.secrets where name='darkstar_crossbase_trigger_v1')
```
Watchdog:
```sql
update public.agent_registry set status='OFFLINE',connection_status='not_connected',current_action='HEARTBEAT_STALE_OVER_180_SECONDS',updated_at=now() where agent_id in ('darkstar','technical-dark-star') and (last_heartbeat is null or last_heartbeat<now()-interval '3 minutes') and connection_status<>'not_connected';
```
Disable work with cron.alter_job(15,active:=false). To disable all three use the named jobs after checking their identities; do not alter unrelated schedules.
