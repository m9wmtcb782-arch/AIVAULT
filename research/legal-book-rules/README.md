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

Quality audit: 102 implementation tests now pass after fixing malformed-source handling and unknown-scope acceptance. A separate probe of the real card answered 3/3 registered aliases but 0/6 new related wordings. The module does not meet general legal-solving or assistant-parity standards. See `QUALITY-AUDIT.md`; regression-test totals are not answer-accuracy measurements.

Follow-up: `concept-question.cjs` adds bounded composition of reviewed concepts, comparison, directed inclusion and negated questions. `reason-question.cjs` returns source-bound reviewed reasons for bounded why-questions. 141 engineering tests pass. The former six failures now pass as regression checks; six additional concept prompts and three source-reason prompts also pass developer checks. See `CONCEPT-AND-REASON.md` and `test/audit-knowledge.cjs`. These results do not establish general legal-solving or assistant parity; arbitrary question understanding and real-case application remain incomplete.

Case continuation: `book-case.cjs` now binds explicit case-fact clauses to reviewed book-concept rules and returns source/fact/condition/conclusion explanations. `solve.cjs` exposes a single no-model entry point. 167 engineering tests pass; 8 source-based hypothetical case checks match expected behavior, including 3 substantive conclusions and 5 unresolved/conflicting outcomes. This is still bounded book-concept application, not independent classification of legal facts, current-law advice or assistant parity. See `BOOK-CASE-APPLICATION.md` and `test/audit-cases.cjs`.

Narrative continuation: `narrative.cjs` tracks explicitly named case roles, unique antecedents, contrast clauses and same-sentence omitted subjects without changing source offsets. Conditional/quoted scope and ambiguous references cannot become unconditional facts. 186 engineering tests pass. Original 8 plus 13 narrative cases match expected behavior; 8 produce book-concept conclusions and 13 require review or more facts. This remains developer evaluation in one narrow domain. See `NARRATIVE-FACTS.md`.

2026-10-19 後續修正：案例求解現在會檢查尚未釐清的相反規則，避免因一條充分規則已成立就過早下結論。互斥約束的推導獨立留痕，不冒充明示事實。194 項工程測試通過；教材 21 案例維持原預期行為。詳見 BOOK-CASE-APPLICATION.md；這仍是有限範圍研究模組，不代表已達通用法律推理能力。

2026-10-19 多步推導：新增可選 derivations，已接入原有 solve → book_case 入口，分開保存明示事實與推導命題，拒絕循環、相反中間結果及未知例外。221 項工程測試通過；以私有教材第 51–52 頁建立的兩步實驗卡，9 個對照案例符合預期（4 項作答、5 項未決／矛盾）。不代表任意章節自動理解或模型能力相當。詳見 MULTISTEP-PROOFS.md。

2026-10-19 嚴格依據檢查：補查推導命題與明示事實間的互斥衝突，並按實際成立分支整理支持依據。相反規則的排除檢查另列，不冒充正向支持。新增條件刪除測試，完整 231 項通過；教材回歸維持預期。詳見 MULTISTEP-PROOFS.md 後續記錄。
