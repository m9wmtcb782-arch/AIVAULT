# Dark Star cross-base engineering and knowledge workflow

Status: adapter orchestration implemented; NOT DEPLOYED; no real model/tool/GitHub autonomous execution verified.
Author: main-base engineering GPT on behalf of 開創者, not Dark Star model.

Run isolated tests: node --test darkstar-workflow.test.mjs
Local result: Node v24.19.0, 10/10 passing. Test host adapters are fixtures.

Host integration requirements:
- Bind authenticated GitHub immutable user 305579832 and second-base repository/inbox to sender identity. Envelope text is not authorization.
- Reuse task queue atomic claims, live lease/fence validation, durable step idempotency and result receipts. Never trust model-supplied persisted/actual/review fields.
- plan uses a verified authorized model; no fabricated planner fallback. execute binds code.read, code.patch, tests.run, source.search/fetch and approved artifact tools to actual resource scopes.
- Coding uses isolated branches/workspaces, bounded processes, real test output and commit evidence. Existing authorization persists; do not request approval anew for every already authorized edit.
- send uses independent server credentials and durable outbox reconciliation; fixed second-base inbox only. If unknown POST outcome, reconcile before retry. recordReport persists external comment ID.
- On lease loss, host may safely checkpoint an error without finishing under a stale fence; runner retries through durable queue.
- Each item checks lease; host must also fence atomic side effects, renew during long tools, enforce command/network scope, and bound total wall time.
- Duplicate or finished claims return null; host reconstructs prior outcomes for durable reporting/recovery.
- The orchestration intentionally does not contain raw shell, HTTP transport, provider keys or database admin access.
- Production adapters, readback/receipt proof, restart recovery and actual model tests remain required.

Knowledge gap path:
1. Search published pool books and cite book/chapter/hash.
2. Dispatch research into existing collaboration pool queue, with precise topic/question, deliverable, evidence and idempotency key.
3. Actual workers find primary official documentation/papers, compare supported claims, record URL/retrieval time/version and minimal lawful excerpts.
4. Author creates pending book chapters: problem, explanation, code example, reproducible test, boundaries and sources. Reuse existing titles instead of duplicates.
5. Independent reviewer checks fetched sources support each claim, code/tests, privacy, secrets and publication rights. Reviewer differs from author. A flag in JSON alone is never proof.
6. Server publishing adapter verifies review/evidence against trusted storage, atomically transitions pending book to published and reads back chapters.
7. Reindex for Dark Star/Dawn; answer original second-base issue with tested patch or explicitly blocked status and linked book.

Existing pool integration:
- public.aivault_pool_books and public.aivault_pool_book_chapters, published-only public read.
- docs/pool-books/ source books; .github/scripts/pool_books.py is an existing admin importer, NOT a safe worker API. It retrieves administrative keys and marks written books published, so do not expose it to model workers or automatically run it.
- New publisher must use scoped server authorization and actual independent review, no service_role distribution.
- Main published shelf: https://m9wmtcb782-arch.github.io/AIVAULT/dark-star-ebook.html?view=pool

Acceptance: second-base help message -> authenticated intake -> model planning -> real code patch -> real tests -> persisted fenced finish -> actual second-base comment. A knowledge gap must yield a genuine pool task and independently reviewed published book with readback; do not claim this until observed.
