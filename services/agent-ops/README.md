# AIVAULT Agent Ops — Phase 1（未部署）
模組：identity / vault / mail-engine（nodemailer + imapflow）/ dns-check / github-connector / communication（呼叫既有 ai-gateway）/ governance（既有 Governance/Causal 的轉接器）/ scheduler / console。
- `npm ci && npm test`：單元測試 + LOCAL SMTP/IMAP（127.0.0.1）+ LOCAL Postgres（PGlite）migration 測試。
- `GH_TOKEN=... npm run check:github`：GitHub 唯讀外部檢查（/user、/notifications）。
- 標示規則：LOCAL = 本機協定測試，不代表網際網路投遞；MOCK = 假的外部回應；EXTERNAL = 真實外部服務。
- Migration `supabase/migrations/20261101000000_aivault_agent_ops_phase1.sql` 只是檔案，尚未套用。
- 不包含任何金鑰。Provider 憑證只能存在後端 Secrets / Vault。
