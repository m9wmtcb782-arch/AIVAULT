# pb4：no-LLM 閱讀層讀「協作池書架」（必讀順序：基礎→入門→專業，再讀資料選輯）。0 token，抽取式摘要。
# 由 city_reading.py 呼叫；每位代理照順序讀下一個沒讀過的章節，紀錄 url='poolbook:<book>#ch<n>'。關閉：POOL_READ_OFF=1 或 floor_state poolbooks:off。
import os, re, hashlib
class PoolRead:
    def __init__(self, rest, summarize):
        self.sum=summarize; self.order=[]
        if os.environ.get("POOL_READ_OFF")=="1": return
        try:
            off=rest("aivault_floor_state?k=eq.poolbooks:off&select=v")
            if off and (off[0]["v"] or {}).get("off")=="1": return
            books=rest("aivault_pool_books?status=eq.published&select=id,title,tier,tier_order,sort_order,kind&order=kind.desc,tier_order.asc,sort_order.asc") or []
            chs=rest("aivault_pool_book_chapters?select=book_id,chapter_no,title,content&order=book_id,chapter_no&limit=5000") or []
        except Exception as e: print("poolread err",type(e).__name__); return
        by={}; [by.setdefault(c["book_id"],[]).append(c) for c in chs]
        for b in books:  # kind.desc → written 先、anthology 後
            for c in by.get(b["id"],[]): self.order.append((b,c))
        print("poolread chapters",len(self.order))
    def next(self, agent_id, seen):
        for b,c in self.order:
            u="poolbook:%s#ch%d"%(b["id"],c["chapter_no"])
            if u in seen: continue
            text=re.sub(r"\s+"," ",c["content"]); s,kw=self.sum(text)
            if len(s)<60: s=text[:450]
            o={"url":u,"title":"📚 協作池書架《%s》%s｜%s"%(b["title"],b["tier"],c["title"]),"text":text,"summary":s,"kw":kw,"sha":hashlib.sha256(text.encode()).hexdigest(),"bytes":len(text.encode()),"src":"poolbook"}
            return o,("讀書：《%s》"%b["title"][:30],"poolbook:"+b["id"],"")
        return None
