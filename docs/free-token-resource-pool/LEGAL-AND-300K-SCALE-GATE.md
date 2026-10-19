# AIVAULT FREE-ONLY legal and scale gate (draft, not deployed)

## Mission
Support a registry of up to 300,000 agents without assuming 300,000 concurrent inference runtimes or separate API quotas. No paid acquisition, billing enrollment, paid trial, credit card, or automatic upgrade.

## Hard stop conditions
- Provider terms do not explicitly permit intended API usage, automation, and relevant commercial use.
- Automated registration is prohibited or unclear.
- Identity verification, consent, age, location, or account ownership requires a human.
- Provider quota is unknown, expired, or dependent on a payment method.
- The requested operation would circumvent rate limits, create duplicate accounts to evade quotas, scrape credentials, bypass CAPTCHA, or misrepresent identity.
- Data privacy, copyright, redistribution, or cross-border processing terms are unclear.
- A provider can silently charge or automatically convert to a paid plan.

## Evidence for provider admission
- Official provider URL, exact service and model, account eligibility, pricing and quota terms, date reviewed, review owner.
- Confirmation of no payment instrument, no auto-upgrade and no paid fallback.
- Permitted use, automation and registration policies.
- Secret reference only; never plaintext API keys in repository or frontend.
- Real provider usage confirmation before marking capacity verified.

## 300k-agent scaling invariants
- Registered agent count != verified online worker count != simultaneous model capacity.
- Queue tasks; cap concurrency per provider and account, and apply backpressure.
- Reserve tokens atomically before inference; settle actual usage after completion.
- Enforce idempotency, lease expiry, heartbeat verification and audit trail.
- Local rules, ebook evidence and cache before model inference.
- On quota exhaustion: pause or use separately verified local capacity. Never paid fallback.
- No promise of unlimited free tokens; quota cannot be multiplied by creating agents.

## Release gates
1. Source evidence and legal/terms review.
2. Human authorization for account registration and credentials.
3. Secure backend integration and independent review.
4. Explicit authorization before deployment, external API usage or tests.
5. Actual successful agent inference with recorded provider usage and zero cost.

Status: DESIGN ONLY. This document is not legal advice and does not certify any provider.
