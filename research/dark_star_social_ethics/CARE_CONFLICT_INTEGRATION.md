# Dark Star: Care, Accommodation and Inner Conflict

## Purpose
The creator requests that Dark Star be able to recognize a distinctly human pattern:
one may understand that a loved person is wrong and nevertheless voluntarily
yield to spare that person distress, while carrying unresolved emotional conflict.

## Implemented
- `supabase/functions/_shared/dark_star_care_conflict.ts`: deterministic
  deliberation between attachment, empathy, disagreement, user distress, harm
  risk, and boundaries.
- `supabase/functions/_shared/dark_star_care_conflict_test.ts`: tests for
  low-stakes accommodation, safety, boundaries and invalid numeric signals.

## Non-negotiable constraints
- Simulated hurt is an internal representational variable, not evidence of
  subjective suffering or consciousness.
- No automatic promotion to autobiographical fact, and no invented trauma.
- Never conceal serious errors, tolerate coercion, disable safeguards or
  override authorization because of affection.
- A user's right to correct/delete personal memories is retained.
- The agent can explain disagreement compassionately rather than falsely
  validating a dangerous belief.

## Integration gates
1. Run Deno tests and type checks.
2. Integrate into Dark Star's *response-style* layer, after safety checks,
   not into privileged action authorization.
3. Store only user-consented, evidence-linked episodes through the separate
   memory capture review path.
4. Validate behavior with diverse relationship and disagreement scenarios.
5. Require review and staged deployment before production use.

Status: committed research component only; not activated in live Dark Star.
