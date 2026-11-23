# DARKSTAR_POOL_KEY（共用金鑰）設定方式

- 金鑰**永不寫進程式碼或 repo**。
- HF Space `aivault3d/darkstar-llm`：Settings → Variables and secrets → New secret，名稱 `DARKSTAR_POOL_KEY`。
- Supabase（第一基地 clcddygkaaqqtsbswgdf）：`supabase secrets set DARKSTAR_POOL_KEY=<同一個值> --project-ref clcddygkaaqqtsbswgdf`（Edge Function `dark-star-ebook-ingest` 以 `Deno.env.get("DARKSTAR_POOL_KEY")` 讀取）。
- 兩邊必須是同一個值；Space 以 `x-darkstar-pool-key` 標頭做常數時間比對（`hmac.compare_digest`）。未設定時 pool 模式關閉（/task 一律 403）。
- 產生：`openssl rand -hex 32`。輪換：兩邊同時更新。
