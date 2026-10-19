# AIVAULT CPU-only legal book rules — v0.1

Isolated prototype based on main `21d3d99b57fec41344aa1bc9252ec213f6ab3653`.

Run with Node.js: `node --test research/legal-book-rules/test/*.test.cjs`

No dependencies, model requests, paid APIs, GPU or database changes. Not integrated into the production answer flow. No automatic fallback has been enabled.

Implemented: preserve original text and punctuation; flag question/rhetoric, quotation, attribution, negation, conditions, exceptions, scope, logical links, modality, cross-references, numbers and delimiter/OCR errors. Require explicit source/authorization/scope metadata. Return whole passages or a context-needed status. Exclude unauthorized content from both output and diagnostic objects.

All accepted passages remain `eligibleAsConclusion: false`. Keywords and punctuation flags are candidate-screening signals, not proofs of meaning or truth. Callers must supply trusted source metadata; the prototype does not verify metadata authenticity or infer semantic completeness. `apply_to_case` is explicitly unsupported. No regex marker is presented as complete Chinese parsing.

The continuation adds `src/argument.cjs`: immutable-by-validation original page snapshots with SHA-256, exact UTF-16 source spans, reviewed-card digest matching through a trusted caller registry, bounded three-valued AND/OR/NOT execution, exception gating, and conflicting-view preservation. Necessary-only rules, questions as conclusions, unreviewed cards, stale source versions, and unknown decisive facts cannot produce supported conclusions. `SUPPORTED_BY_REVIEWED_RULE` means only that a reviewed formal rule applies to explicitly supplied facts; it is not independent verification of the source or facts. No automatic Chinese-to-rule conversion has been implemented.

Next: actual paragraph/cross-page fetching with completeness verification, first reviewed real-book argument cards, provenance of explicit question facts, held-out real-book evaluation, then an independent no-model frontend answer path. Do not convert PASSAGE_ONLY into an answer-supported status or send it to Gateway as an automatic fallback. Registry approval, source permissions, scope and fact assertions must come from a trusted caller, not arbitrary client JSON.

The next continuation adds `src/acquire.cjs` and `src/draft.cjs`. Acquisition uses only injected `list` and `context` actions, an explicitly selected book set, bounded page windows, duplicate/wrong-book/missing-page checks and cancellation. Drafts preserve raw text and cross-page source spans, mark potential questions/conditions/exceptions, and remain unreviewed with no executable conclusion. Window completeness is separate from argument completeness. No browser integration is enabled.

99 synthetic tests passed under Node.js v24.19.0 on 2026-10-19. Inspection found that the initial PDF pages 15–17 are front matter, not legal argument. `src/section.cjs` now rejects explicit front matter and contents windows, and marks suspicious TOC records for page verification. Actual chapter 1 was observed beginning on PDF page 50; existing TOC records pointing to page 26 were contents-page locations, not reliable chapter targets.

`src/reading-card.cjs` can return an exactly sourced answer to an explicitly reviewed question alias. A first real-book card distinguishes public administration from state administration using the stored text on PDF page 51, with context checked on pages 50–52. Review was by ChatGPT against extracted text, not human review or PDF-image verification. The private source/card package is saved separately from the repository. No current-law or new-case inference is claimed. Question aliases are literal, not a general-purpose natural-language matching system.

This is not a real-book answer-accuracy benchmark. No iPhone benchmark has been run. No production files have been changed. See `ACQUISITION.md` and `READING-REVIEW.md` for current boundaries.
