# 暗星導讀與報告系統

## 目標
建立暗星的獨立「導讀 → 正式報告 → 結論」能力，不改動 `technical-dark-star.html`。

## 核心原則
- 導讀建立背景、問題意識與閱讀地圖，不提前取代正文。
- 報告依資料性質、讀者、時間與深度自行組織，不寫死單一學科模板。
- 結論回答核心問題並收束重點。
- 沒有可靠資料時，不虛構案例、引用或已確認事實。
- 保留 CONFIRMED / NOT VERIFIED / REQUIRES TEST。

## 第一階段
`dark-star-reading-report.html` 為獨立測試前台。研究生為預設對象，深度只有「研究生｜分析型」與「研究型｜論文型」，不提供兒童、入門、大學、中等等低階模式。

AI 生成已接入 `dark-star-reading-report` Edge Function。研究生模式必須真正分析問題意識、核心概念、論證、證據、因果／制度關係、爭點、不同觀點、限制與實務意義；研究型／論文型再增加理論／文獻比較、研究問題、方法限制與研究缺口。

即時語音不屬於本次修改範圍，`technical-dark-star.html` 與 Live voice 程式維持不動。

## 驗收
1. 不修改 `technical-dark-star.html`。
2. 導讀與正式報告內容分離。
3. 10/25/40/60 分鐘可改變報告規模。
4. 可依內容類型、研究生／專業讀者與兩級深度調整。
5. AI 生成必須產出實質分析，不得以結構、目錄或摘要冒充。
6. 即時語音鏈路不得因本功能修改而變更。


## 第二階段｜多模態素材與導讀 PPT（2026-10-06）
前台 `dark-star-reading-report.html` 已增量加入素材入口，不修改 `technical-dark-star.html`。

支援素材入口：
- Word：`.doc/.docx`
- PowerPoint：`.ppt/.pptx`
- PDF
- Excel：`.xls/.xlsx`
- MP4
- MP3
- WAV
- JPG/JPEG/PNG
- 網路連結

目前前端對 DOCX、XLS/XLSX、PPTX、純文字類素材可先取得可分析文字；PDF、圖片、影音及網路連結會保留為「多模態素材」標記，不偽造其內容。真正的影片畫面、音訊／音樂與圖片語義理解仍需專用多模態後端完成，因此不能在尚未接通時標示 CONFIRMED。

導讀輸出增加 PPT 生成：
- 每一個導讀輸出頁對應一張 PPT。
- 每張 PPT 保留該頁講解稿。
- PPT 生成後，Gemini Live 的講解控制應以「第 N 頁」為單位逐頁送出，不得自行跳頁、重組或預讀。
- Gemini Live 仍只負責自然口語表達；暗星負責素材理解、頁面內容與講解稿。

本階段沒有修改 Technical Dark Star Live voice 核心。
