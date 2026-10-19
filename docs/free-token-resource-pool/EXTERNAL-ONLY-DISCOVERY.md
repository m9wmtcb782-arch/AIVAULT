# External-only discovery directive — 2026-10-19

Scope: External third-party AI inference API free tiers only. Exclude AIVAULT-owned ebook, ANN, GPU, local models, and existing internal token inventory from discovery metrics.

## Initial official candidates
1. Groq API Free Plan — https://console.groq.com/docs/rate-limits
   - Official rate limits published per model, organization-level, not per agent.
   - State: REVIEW_REQUIRED. Confirm account eligibility, zero billing risk, intended use, automation and commercial use.
2. Gemini Developer API Free Tier — https://ai.google.dev/gemini-api/docs/pricing
   - Official pricing lists selected free-tier models and free input/output tokens; other models are paid-only.
   - State: REVIEW_REQUIRED. Confirm no payment instrument, account-specific quota, data-use terms and model availability.

## Dispatch policy
- Only authenticated, live workers with permitted search capability may be assigned discovery jobs.
- Deduplicate providers, URLs and evidence across all workers. Search does not require model inference.
- Start at max 10 concurrent searches, with rate limits and backoff; expand only after verified legal and operational readiness.
- No autonomous account creation, CAPTCHA bypass, duplicate accounts for quota circumvention, credential collection, or billing enrollment.
- Distinguish candidate discovery from real quota verification and successful inference. Never claim resources are pooled before proof.
- Do not touch paid Grok or Kling APIs, production agent pages or existing provider keys.

## Acceptance
First goal: at least one third-party free account explicitly authorized by owner, backend-only credential, confirmed free quota, real zero-charge agent inference and reconciled usage. This file does not execute any search jobs or model calls.
