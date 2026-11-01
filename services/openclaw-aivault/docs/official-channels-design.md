# AIVAULT 官方頻道接入設計（LINE / Telegram / Discord）— 設計稿，尚未連線

## 原則
- 每個平台只有 **一個官方 bot / 官方帳號**，以 AIVAULT 名義申請；10 萬 AI 身分都在它後面，由 OpenClaw 閘道動態載入（session key `aivault-id-<agent_code>`）。
- **不建立任何個人帳號、假帳號、批量帳號**；不冒充真人；不規避 CAPTCHA 或平台反濫用。
- 每則訊息都帶 AI 標示：`【AI・Worker-001 凌安安｜AIVAULT 人工智慧，非真人】`（外掛 `message_sending` hook + 管線雙重加上）。
- 只回應「主動找 bot 的使用者」或創辦人指定的群組；不主動私訊陌生人，不大量發文、不製造按讚/互動。
- 憑證（Channel secret、Bot token）只放後端 secret（OpenClaw SecretRef / Supabase secret），不進 GitHub、前端、log。
- 閘道仍只綁 loopback；平台 webhook 經 Cloudflare Tunnel 或 Worker 轉送到單一路徑，並驗證平台簽章。

## 身分路由（一個 bot，多個 AI）
1. 使用者訊息進入官方 bot → OpenClaw channel 外掛。
2. AIVAULT 路由器依規則選身分：使用者指定（`@凌安安` / `/ai Worker-001`）→ 任務類型對應學歷/角色 → 輪值。
3. session key = `agent:aivault:aivault-id-<agent_code>:<platform>:<chatId>`；回覆前標示 AI 身分。
4. 全部經學徒管線：共同記憶 → 不二過 → 額度守門（學習最多一半，另一半保留給暗星）→ 師父。

## 各平台步驟
| 步驟 | LINE Messaging API（官方帳號） | Telegram bot | Discord bot | 誰做 |
|---|---|---|---|---|
| 1 建立官方帳號/bot | LINE Developers 建 Provider + Messaging API channel（官方帳號） | @BotFather `/newbot` | Developer Portal 建 Application + Bot | **創辦人登入**（需本人帳號、條款同意） |
| 2 取得憑證 | Channel secret + Channel access token | Bot token | Bot token（開 Message Content intent 需審） | **創辦人登入**，貼進後端 secret 表單 |
| 3 Webhook/連線 | 設 webhook URL（HTTPS） | webhook 或 long polling | Gateway WebSocket（不需公開 URL） | Grok Bot 準備；LINE/Telegram 公開 URL 需創辦人批准 Tunnel/網域 |
| 4 OpenClaw 設定 | `channels.line` | `channels.telegram` | `channels.discord` | Grok Bot（PR，待批准） |
| 5 允許名單 | 只允許加好友者/指定群 | `allowFrom` 指定使用者/群 | 只加入創辦人的伺服器 | 創辦人決定名單 |
| 6 上線 | 先 1 個測試群、10 個身分 | 同左 | 同左 | **創辦人批准** |

注意：LINE 免費方案每月推播訊息有限額（回覆訊息不計），只用 reply；OpenClaw 沙盒預設禁止頻道工具（sandbox deny 含 line/telegram/discord），上線時只開放「回覆」不開放任意發訊。

## 不做的事
不申請 Google/LINE/Telegram 個人帳號給 AI；不讓 AI 到外部平台留言或按讚；不使用自動化註冊。
