
## base1：370/609 接線（60.8%），609 已對應，排除 6
| 類型 | 數量 | 已接線 |
|---|---|---|
| edge_entry | 25 | 22 |
| edge_module | 35 | 32 |
| frontend_js | 141 | 89 |
| frontend_page | 153 | 145 |
| migration/sql | 69 | 0 |
| onnx_model | 2 | 1 |
| script | 62 | 0 |
| script/py | 42 | 29 |
| service | 28 | 0 |
| workflow | 52 | 52 |

器官分布：motor 236、reflex 100、sensory 94、cortex 108、memory 71

未接線原因：
- 91 × not referenced by any wired page (loaded dynamically, unused, or Node-side)
- 69 × memory organ: attachable via neural_attach(table) — needs founder approval (would add DB triggers)
- 37 × offline/dev script (not part of live runtime)
- 28 × Node service: SDK neural-bus-node.mjs available; not imported (no live caller)
- 8 × no </head> tag (fragment/partial page)
- 4 × excluded: vendored third-party code
- 3 × parent function entry not wired
- 2 × excluded: backup copy, not live
- 2 × no HTTP entry found
- 1 × uses std/http serve() not Deno.serve — needs manual wrap

## base2：311/557 接線（55.8%），557 已對應，排除 6
| 類型 | 數量 | 已接線 |
|---|---|---|
| edge_entry | 33 | 31 |
| edge_module | 33 | 31 |
| frontend_js | 173 | 93 |
| frontend_page | 157 | 151 |
| migration/sql | 77 | 0 |
| onnx_model | 3 | 2 |
| script | 28 | 0 |
| script/py | 49 | 0 |
| service | 1 | 0 |
| workflow | 3 | 3 |

器官分布：reflex 40、cortex 98、motor 236、memory 79、sensory 104

未接線原因：
- 84 × not referenced by any wired page (loaded dynamically, unused, or Node-side)
- 77 × memory organ: attachable via neural_attach(table) — needs founder approval (would add DB triggers)
- 74 × offline/dev script (not part of live runtime)
- 6 × no </head> tag (fragment/partial page)
- 4 × excluded: vendored third-party code
- 2 × excluded: backup copy, not live
- 2 × no HTTP entry found
- 2 × parent function entry not wired
- 1 × Node service: SDK neural-bus-node.mjs available; not imported (no live caller)
