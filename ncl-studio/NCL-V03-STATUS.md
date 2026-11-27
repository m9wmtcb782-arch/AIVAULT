# NCL v0.3 Runtime Hardening — 2026-11-27

## Scope
- Repository: m9wmtcb782-arch/AIVAULT (first base only)
- Branch: feat/ncl-v03-runtime-hardening-20261127
- No Supabase, secrets, paid APIs, second-base repository, production deployment, or merge operations.

## Changes
- Hardened the existing browser interpreter while preserving the `window.NCLv02.parse/execute` API used by the current Studio page.
- Added strict expression tokenization: unknown characters now fail instead of being silently skipped.
- Added boolean literals, string concatenation with `+`, explicit type checks, and finite-number checks.
- Division by zero now fails explicitly.
- Added duplicate variable/task declaration checks.
- Kept execution guards: 10,000 steps, 1,000 repeat iterations, 20 nested task calls, and 1,000 output lines.
- Added `ncl-runtime-tests.html` with 16 browser acceptance cases.

## Evidence and status
- CONFIRMED: changes are committed to this feature branch.
- CONFIRMED: test harness file is present in the branch.
- REQUIRES TEST: run the browser acceptance page on desktop and iPhone Safari; no browser execution result is claimed here.
- NOT VERIFIED: performance, memory use, GPU acceleration, Metal, neural-network training, dynamic neural connections, and large-model inference.
- BLOCKED: claiming native iPhone GPU or 70B execution until an actual Metal backend, model-loading path, and device measurements exist.

## Important compatibility note
The Studio HTML still displays a v0.1 label and loads the interpreter from the legacy filename `ncl-runtime-v02.js`. The API is preserved for compatibility, but the visible version label and Studio integration need a separate UI pass after acceptance tests pass.

## Next engineering gates
1. Execute all 16 browser tests and record actual output.
2. Add deterministic tests for malformed source, nested loops, task recursion, and resource caps.
3. Separate lexer/parser/runtime modules and define a stable NCL IR schema.
4. Add a real tensor API and CPU reference backend before any GPU work.
5. Only then prototype Apple Metal through a native iOS/macOS host; Canvas is not a compute backend.
6. Establish reproducible model-load, inference, memory, and thermal benchmarks before making any phone/70B claims.
