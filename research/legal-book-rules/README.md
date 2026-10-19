# AIVAULT CPU-only legal book rules — v0.1

Isolated prototype based on main `21d3d99b57fec41344aa1bc9252ec213f6ab3653`.

Run with Node.js: `node --test research/legal-book-rules/test/engine.test.cjs`

No dependencies, model requests, paid APIs, GPU or database changes. Not integrated into the production answer flow. No automatic fallback has been enabled.

Implemented: preserve original text and punctuation; flag question/rhetoric, quotation, attribution, negation, conditions, exceptions, scope, logical links, modality, cross-references, numbers and delimiter/OCR errors. Require explicit source/authorization/scope metadata. Return whole passages or a context-needed status. Exclude unauthorized content from both output and diagnostic objects.

All accepted passages remain `eligibleAsConclusion: false`. Keywords and punctuation flags are candidate-screening signals, not proofs of meaning or truth. Callers must supply trusted source metadata; the prototype does not verify metadata authenticity or infer semantic completeness. `apply_to_case` is explicitly unsupported. No regex marker is presented as complete Chinese parsing.

Next: original paragraph and cross-page acquisition, attributed argument cards reviewed against source text, three-valued condition/exception execution, held-out real-book evaluation, then an independent no-model frontend answer path. Do not convert PASSAGE_ONLY into an answer-supported status or send it to Gateway as an automatic fallback.

Tests use synthetic language fixtures only. The tests establish implementation behavior, not real-world legal answer accuracy. 29 tests passed under Node.js v24.19.0 on 2026-10-19; no iPhone or real-book benchmark has been run for this prototype.
