# Search infrastructure: billing risk gate (2026-10-19)

## Brave Search API — BLOCKED for AIVAULT FREE-ONLY
Official sources:
- https://brave.com/search/api/
- https://api-dashboard.search.brave.com/documentation/resources/help-feedback
- https://api-dashboard.search.brave.com/documentation/pricing

Findings:
- Search API offers $5 monthly credits, approximately 1,000 search queries at the listed $5/1,000 requests rate.
- Official FAQ states there is no standalone free API plan.
- Credit card is required to access the free credits, even with a $0 prepay balance; card verification may place a temporary authorization hold.
- API result storage rights are subject to plan terms.
Decision: BLOCKED. Do not sign up, add a card, call the API, or use its paid credits. A promotional credit is not a zero-risk free plan under AIVAULT policy.

## Search worker dependency
Do not connect the 2,000 registered agents to an unapproved search provider. First identify a search transport with:
1. Explicit automation permission and permitted storage/reuse of results.
2. No credit card or billing activation.
3. No automatic paid fallback or excess charges.
4. Enforceable quota ceiling, credential safety, audit trail.
5. Real runtime and fresh heartbeat, not just database records.

Alternative for evaluation: individually authorized official provider documentation sources, fetched within their terms and rate limits. Do not scrape search engine results or evade anti-bot controls.

State: source review only. No live worker activation, no external API call, no free inference capacity deposited.
