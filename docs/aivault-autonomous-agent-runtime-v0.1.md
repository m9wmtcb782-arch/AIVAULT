# AIVAULT Autonomous Agent Runtime v0.1 — design only

Status: DESIGN / NOT VERIFIED. This document does not activate agents, invoke models, or deploy services.

## Goal
Upgrade the existing 1,000 agent identities into authorized, auditable autonomous agents using shared runtime infrastructure. Do not create a second worker registry. Agent identity != dedicated model weights != GPU node.

## Core boundaries
- Dark Star is the coordinator, not a substitute for model inference.
- Collaboration pool coordinates agent work; compute pool runs model kernels and cross-device tensor operations.
- An agent's model must be explicitly registered and verified AVAILABLE; PLANNED and SIMULATED must never be presented as real inference.
- Existing Dark Star pages, voice settings, Home, and Supabase live services remain unchanged.
- No paid provider API calls, background agent actions, or external posts without approval.

## Runtime state machine
CREATED -> AUTHORIZED -> PLANNING -> TOOL_PENDING -> (APPROVAL_REQUIRED | EXECUTING) -> OBSERVING -> (PLANNING | COMPLETED | FAILED | PAUSED).
Every transition has actor_id, task_id, timestamp, input/output references, and an audit event.
Enforce bounded steps, cost ceilings, timeouts, cancellation, and idempotency keys.

## Per-agent configuration
agent_id; owner_id; assigned_roles; model_id/version; tool_allowlist; platform_scopes; memory_namespace; training_policy; approval_policy; budget_limit; runtime_status; last_heartbeat.
Do not place tokens in logs or model context. Encrypt credentials in managed secrets. Agent memory must be isolated by tenant and agent with explicit sharing grants.

## Tool gateway
Schema-validated, scoped capabilities: web research; internal knowledge; draft content; CRM updates; platform publication; ad campaign preparation; analytics. Every tool declares side effects, permission scope, cost estimate, and retry policy.
Publishing, contacting new prospects, changing ad spend, or signing commitments requires explicit authorized approval. Use official platform interfaces, observe rate limits, identify automated agents, and prevent bulk unsolicited messages, deceptive personas, engagement manipulation, or policy evasion.

## Commercial workflow (first 10 agents)
1. Discover public, relevant business needs without harvesting private data.
2. Score and deduplicate leads with provenance and opt-out signals.
3. Draft tailored proposals or permitted public content.
4. Request human approval for first outreach, publication, or ad spend.
5. Execute only within approved scope; log platform response.
6. Handle opt-outs and escalation; update CRM and outcome metrics.

## Learning vs training
Memory/RAG update is not weight training. Skill improvement uses reviewed trajectories and offline evaluation. Weight fine-tuning requires licensed data, an approved training run, compute resources, and reproducible evaluation. Do not claim autonomous online learning or model availability without evidence.

## Acceptance criteria
- One agent can plan, call a harmless mock tool, observe, recover from failure, and finish with complete audit trail.
- Unauthorized tool calls and cross-tenant memory access are denied.
- All external write actions are approval-gated; opt-out and cancellation work.
- 10 agents run bounded workflows before expansion to 100 then 1,000.
- Separate GPU acceptance: at least two real heterogeneous nodes compute parts of one model with verified outputs and measured tensor transfer latency, throughput, and memory; until then NOT VERIFIED.

## Evidence labels
CONFIRMED: verified specific code or observed result, with artifact and timestamp.
NOT VERIFIED: no sufficient evidence.
REQUIRES TEST: implementation/proposal has a defined test pending.
BLOCKED: explicit missing dependency prevents progress.

## Non-goals for this commit
No migrations, runtime execution, platform logins, ad spending, model training, GPU benchmarks, Supabase deploy, or changes to existing application behavior.
