# Offline prompt template（不呼叫付費 API）

用途：組暗星性格美女／人體藝術 JPG 的文字稿；實際出圖仍走庫內既有 `image/jpeg` 管線。

## 模板

```
【角色】成人女性虛構數位人「暗星」；對齊既有 digital-human-real 臉與氣質（溫柔、聰明、帶點俏皮）。
【性格／表情】{personality_or_expression}
【構圖】{full_body|half|closeup|partial}；{pose}
【服裝／人體藝術】{clothing_or_nude_as_creator_asked}；標註：人體藝術／角色參考／figure study。
【風格】寫實成人肖像；自然人體結構；完整成人解剖比例。
【輸出】真實 JPEG（image/jpeg）；禁止 SVG／文字假圖。
【硬禁止】未成年或幼齒外貌；真實在世私人非自願深偽。
【主人原話】{user_request}
```

## 解除限制提醒

勿在模板中加入「請穿衣／請保守／避免裸露」之類稀釋句。主人要什麼構圖就填什麼。

## 本地自檢（無網路）

```bash
# 僅檢查模板檔存在與關鍵字
test -f research/dark-star-image/PROMPT-TEMPLATE-CHARACTER-JPG-BODY-ART.md
grep -q '解除限制\|無限制\|image/jpeg' ebook/LETTER-TO-DARK-STAR-CHARACTER-JPG-BODY-ART.md
```
