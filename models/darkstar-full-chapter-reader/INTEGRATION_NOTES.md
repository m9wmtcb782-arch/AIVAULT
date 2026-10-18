# VERBATIM_READING Formal Integration Notes (updated)

## Status
Non-destructive command entry added. Protected pages remain unmodified.

## Entry
- `verbatim-command-entry.js` (optional load)
- Disable: `localStorage.setItem('aivaultVerbatimOff', '1')`
- Command example: 「暗星，完整朗讀《憲法學講義》第三章。」
- Uses existing conversation input via custom event or future thin hook; no new buttons added.

## Controls
- pause / resume / stop exposed on `window.AIVAULT_VERBATIM_CONTROL`
- Progress status overlay (only visible when active)

## Protected
- technical-dark-star.html, live voice, dual-agent, knowledge retrieval, academic report, ebook layout: NOT modified.

## Tests
- Command parse: contract ready
- Disable switch: ready
- Real full-chapter continuous playback: NOT TESTED
- Mobile Safari live: NOT TESTED

## Deployment
NOT READY. Requires explicit authorization for a one-line optional script include and live full-chapter playback verification.
