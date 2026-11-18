# 電子書可見度測試（離線）

```
deno test -A tests/ebook-privacy/
```

- `ebook_access_test.ts`：可見度矩陣（public／members／owner × 訪客／被拒帳號／其他會員／本人／owner 角色）。
- `handler_test.ts`：用假 Supabase（`mock_supabase.ts`）啟動真正的 `dark-star-ebook-ingest/index.ts`（含 `?feature=photo-solve`），逐一呼叫 book／toc／context／lesson_units／lesson_unit／progress／list（分頁）／study_set／photo-solve search、books／create。
- `sql_test.ts`：用 PGlite（WASM Postgres）套用 `20261118090000_ebook_owner_visibility.sql`，驗證既有公開書維持 public、搜尋函式過濾、函式權限、storage policy。

不需要任何密鑰，不連正式 Supabase。
