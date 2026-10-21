# Gemini key 10 deployment

Status: not yet enabled for 50 percent reserved quota.

The production Gateway recognizes GEMINI_API_KEY10 but has no concurrency-safe reservation mechanism. The quota event agent_id is not reliably populated. Before production rollout, implement verified server-side identity, atomic per-model daily reservation accounting, and real provider call verification. Do not treat an API key being present as proof of successful use.
