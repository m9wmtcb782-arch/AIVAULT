"""Local test book with multi-page chapter for isolation tests.
Includes cross-page paragraph continuity and long text.
"""

CHAPTER_1_PAGES = {
    1: "第一頁開始。這是測試章節的第一段原文，包含標點與特殊字元：「」、——。",
    2: "跨頁段落從這裡繼續，不得斷裂。第二頁内容結束。",
    3: "第三頁是長章節模擬的一部分，用來驗證分段不漏不重複。" * 8,
    4: "章節結尾。最後一句完整結束。"
}

def mock_fetch(action, payload):
    if action == "toc":
        return {"toc": [
            {"title": "第一章 測試章節", "start_page": 1},
            {"title": "第二章", "start_page": 5}
        ]}
    if action == "book":
        p = payload["page_number"]
        return {"page": {"content": CHAPTER_1_PAGES.get(p, "")}}
    return {}
