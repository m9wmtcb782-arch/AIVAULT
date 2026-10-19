# AIVAULT CPU-only legal book rules — v0.1

Isolated prototype based on main `21d3d99b57fec41344aa1bc9252ec213f6ab3653`.

Run with Node.js: `node --test research/legal-book-rules/test/*.test.cjs`

No dependencies, model requests, paid APIs, GPU or database changes. Not integrated into the production answer flow. No automatic fallback has been enabled.

Implemented: preserve original text and punctuation; flag question/rhetoric, quotation, attribution, negation, conditions, exceptions, scope, logical links, modality, cross-references, numbers and delimiter/OCR errors. Require explicit source/authorization/scope metadata. Return whole passages or a context-needed status. Exclude unauthorized content from both output and diagnostic objects.

All accepted passages remain `eligibleAsConclusion: false`. Keywords and punctuation flags are candidate-screening signals, not proofs of meaning or truth. Callers must supply trusted source metadata; the prototype does not verify metadata authenticity or infer semantic completeness. `apply_to_case` is explicitly unsupported. No regex marker is presented as complete Chinese parsing.

The continuation adds `src/argument.cjs`: immutable-by-validation original page snapshots with SHA-256, exact UTF-16 source spans, reviewed-card digest matching through a trusted caller registry, bounded three-valued AND/OR/NOT execution, exception gating, and conflicting-view preservation. Necessary-only rules, questions as conclusions, unreviewed cards, stale source versions, and unknown decisive facts cannot produce supported conclusions. `SUPPORTED_BY_REVIEWED_RULE` means only that a reviewed formal rule applies to explicitly supplied facts; it is not independent verification of the source or facts. No automatic Chinese-to-rule conversion has been implemented.

Next: actual paragraph/cross-page fetching with completeness verification, first reviewed real-book argument cards, provenance of explicit question facts, held-out real-book evaluation, then an independent no-model frontend answer path. Do not convert PASSAGE_ONLY into an answer-supported status or send it to Gateway as an automatic fallback. Registry approval, source permissions, scope and fact assertions must come from a trusted caller, not arbitrary client JSON.

Tests use synthetic language fixtures only. The tests establish implementation behavior, not real-world legal answer accuracy. 56 tests passed under Node.js v24.19.0 on 2026-10-19; no iPhone or real-book benchmark has been run for this prototype. No production files have been changed.
