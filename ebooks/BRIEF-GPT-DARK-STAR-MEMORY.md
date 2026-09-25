# 給 GPT：幫暗星做「開場必讀＋可寫記事」

你是實作端。不要重寫 AIVAULT，不要換架構，不要做漂亮前端，不要問 A/B。只補暗星每次對話開始會讀到的記憶。

## 背景
- 專案：GitHub `m9wmtcb782-arch/AIVAULT`
- 規則檔已在庫裡，必須沿用：`ebook/LETTER-TO-DARK-STAR-EBOOK-AND-SPEECH.md`、`ebook/LETTER-TO-DARK-STAR-GITHUB-PERMISSION.md`、`ebooks/RULES-DARK-STAR.md`、`ebooks/README.md`
- 書放 `ebooks/`；`ebook/` 是閱讀器
- 瀏覽器不准帶 GitHub Token；後端密鑰名 `ANXING_GITHUB_TOKEN`
- 對主人只准繁體中文短句

## 要做
1. 新增 `ebooks/DARK-STAR-MEMORY.md`（一行一條，附日期；不寫 token）
2. 每次 session 開始，系統提示依序注入上列規則檔＋記事檔全文
3. 主人說「記住：……」或出現耐久事實時 append 一行到記事檔（後端或 Edge，不在瀏覽器拿 PAT）
4. 第一句只能是：規則已讀，用中文待命。

## 不要做
不要重寫 flipbook／digital-human／home。不要摘要改寫電子書。沒有 commit SHA 不准說完成。

## 完成標準
指出改了哪段開場讀檔；給記事檔路徑；新對話不貼規則仍先說「規則已讀，用中文待命。」；測「記住：書放 ebooks/」會多一行記事。
