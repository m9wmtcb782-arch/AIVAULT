# Dark Star Runtime Skeleton (base-001)

Minimal continuous controller for the first base.

- Instance: base-001:technical-dark-star
- Heartbeat target: 600s
- Inbox: GitHub Issue #30
- Outbox to Dawn: GitHub Issue #1 on NL13741619-commits/homework-helper
- No fixed Q&A
- No hardcoded provider
- Must keep running when founder is offline

Deploy target: Supabase Edge Function `aivault-dark-star-runtime` on project clcddygkaaqqtsbswgdf.
Scheduler: pg_cron every 10 minutes calling run_once.

Status: skeleton only. Needs model credential and GitHub reply credential to go live.
