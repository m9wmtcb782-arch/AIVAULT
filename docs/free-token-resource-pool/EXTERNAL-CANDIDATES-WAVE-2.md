# External candidate discovery — wave 2 (2026-10-19)

These are external third-party sources only. No AIVAULT-owned capacity is counted.

## Cloudflare Workers AI — REVIEW_REQUIRED (priority)
Official: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers Free allocation: 10,000 Neurons per day; on the free plan usage beyond the allocation fails rather than automatically charging.
- Neurons are provider compute units, NOT AIVAULT tokens. Do not convert 10,000 Neurons to a fabricated token balance.
- Some models explicitly require a paid billing method; reject those models.
- Must verify eligible model, free plan, permitted use and owner authorization before API calls.

## Hugging Face Inference Providers — REVIEW_REQUIRED
Official: https://huggingface.co/docs/inference-providers/pricing
- Free user credits: USD $0.10 monthly, subject to change; this is monetary credit, NOT a token count.
- Extra usage is pay-as-you-go with purchased credits; hard zero-spend guard required.
- Must verify account and billing controls, terms and provider-specific model routing.

## Discovery dispatch
- Deduplicate providers; one legal account quota shared by all authorized agents, not 2,000 accounts.
- Rank no-auto-charge hard-stop free tiers ahead of uncertain credit-based offerings.
- Require official pricing, eligibility, permitted automation and commercial use review.
- No account registration, API key access, paid fallback, inference test or deployment was performed.

States: candidates DISCOVERED; not CREDENTIAL_READY, CAPACITY_VERIFIED, IN_POOL or AGENT_INFERENCE_VERIFIED.
