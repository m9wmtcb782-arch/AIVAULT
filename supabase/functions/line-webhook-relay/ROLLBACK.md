回滾（只移除本次新增物件）：
1. LINE webhook endpoint 改回空或其他網址（PUT /v2/bot/channel/webhook/endpoint）。
2. supabase functions delete line-webhook-relay --project-ref clcddygkaaqqtsbswgdf
3. supabase secrets unset LINE_CHANNEL_SECRET RELAY_POLL_SECRET --project-ref clcddygkaaqqtsbswgdf（先確認無其他 function 使用同名 secret）
4. SQL：drop table public.line_inbox;
5. 刪除 GitHub secrets AIVAULT_LINE_CHANNEL_SECRET、AIVAULT_RELAY_POLL_SECRET 與分支 deploy/line-relay-20261101。
