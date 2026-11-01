# AIVAULT 多模態預先設計 (v4) — 只是設計與 stub

標示：**REAL** = 已存在且已接上；**PLANNED** = 只有介面，沒有模型、沒有呼叫、沒有花費。旗標 `MULTIMODAL_ON` 預設關閉。

## 1. 整體架構
```mermaid
flowchart LR
  U[使用者 / 10萬 AI] --> O[多模態 Orchestrator<br/>route + plan]
  O --> R[(模型登錄表<br/>capability contract)]
  O --> Q[Quota guard<br/>pool 50% / fail-closed]
  O --> T[Text: tiny-router-lora REAL<br/>Groq/Gemini REAL]
  O --> V[Voice EOT / TTS PLANNED]
  O --> I[Image PLANNED]
  O --> M[Music PLANNED]
  O --> VD[Video PLANNED]
  O --> S[Short clipper PLANNED]
  O --> D3[3D PLANNED]
  T & V & I & M & VD & S & D3 --> CM[(共同記憶 cm_entries + cm_assets<br/>已驗證、可撤銷)]
  CM --> O
  DS[暗星: 私有記憶 + 讀寫共同記憶] --> CM
```

## 2. 管線範例：腳本 → 音樂 → 影片 → 短影音
```mermaid
sequenceDiagram
  participant O as Orchestrator
  participant T as Text (REAL)
  participant M as Music (PLANNED)
  participant V as Video (PLANNED)
  participant S as Short clipper (PLANNED)
  participant CM as Common memory
  O->>CM: cm_search(過去成功/失敗的腳本, 不二過)
  O->>T: text>text 腳本
  O->>M: text>music (需付費核准)
  O->>V: text+music>video (需付費核准)
  O->>S: video>short_video
  S->>CM: cm_propose(成品 + CLIP/CLAP 向量) → pending → cm_verify
```

## 3. 能力合約欄位
`id, status(real|planned), in[], out[], cost{unit,est}, quota(free_local|pool_50pct|paid_approval), device(cpu|gpu|api|edge), embed`。
路由順序：REAL 優先 → quota 低者優先 → 超過允許 quota 的步驟回傳 `blocked`（需要創辦人核准）。

## 4. 多模態共同記憶
`cm_assets`（在 `services/common-memory/sql/common_memory_v4.sql`）：每個 entry 可掛多個素材，
`emb_text vector(384)`（MiniLM，REAL）、`emb_image vector(512)`（CLIP-like，PLANNED）、`emb_audio vector(512)`（CLAP-like，PLANNED）、`emb_video vector(512)`（PLANNED）。
撤銷 entry 時，衍生的 lesson / adapter 訓練列一起失效（cascade）。
