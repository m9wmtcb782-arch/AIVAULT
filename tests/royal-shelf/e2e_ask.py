# 手機尺寸無頭測試：「向這本書提問」— 攔截 photo-solve／web-search／ai-gateway（假資料），其餘請求以匿名送真實後端
import asyncio, json, base64, time, sys
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/dark-star-ebook.html"
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
FAKE=b64({"alg":"HS256","typ":"JWT"})+'.'+b64({"sub":"00000000-0000-4000-8000-000000000001","exp":int(time.time())+3600,"role":"authenticated"})+'.sig'
ANSWER="## 結論\n人民代表大會是國家權力機關（本書）。\n## 分析\n- 依本書說明（本書）\n## 與中華民國法律比較\n| 項目 | 中華人民共和國 | 中華民國（台灣） |\n|---|---|---|\n| 相關法律與條文內容 | 人大（本書） | 立法院（書架其他書《中華民國憲法》） |\n| 差異點 | 議行合一 | 權力分立 |\n## 見解\n（AI 見解）\n## 資料限制\n無"
log={'gateway':[], 'search':0, 'web':0}
async def route(r):
    req=r.request; u=req.url
    if 'ai-gateway' in u and req.method=='POST':
        body=json.loads(req.post_data or '{}'); log['gateway'].append(body)
        return await r.fulfill(status=200,content_type='application/json',body=json.dumps({"success":True,"content":ANSWER},ensure_ascii=False))
    if 'feature=photo-solve' in u and req.method=='POST':
        log['search']+=1; body=json.loads(req.post_data or '{}')
        src=[{"page_id":"p-"+str(log['search']),"ebook_id":body.get('ebook_id') or "a14fa90b-0000-4000-8000-000000000000","book_title":"中華民國憲法","page_number":5,"excerpt":"立法院為國家最高立法機關。"*5,"score":5}]
        return await r.fulfill(status=200,content_type='application/json',body=json.dumps({"ok":True,"sources":src},ensure_ascii=False))
    if 'feature=web-search' in u: log['web']+=1; return await r.fulfill(status=200,content_type='application/json',body='{"results":[]}')
    if 'dark-star-ebook-ingest' in u and req.method=='POST':
        h=dict(req.headers); ak=h.get('apikey')
        if ak: h['authorization']='Bearer '+ak
        return await r.continue_(headers=h)
    return await r.continue_()
async def ready(pg):
    for _ in range(60):
        st=await pg.text_content("#catalogStatus")
        if st and ("遠端" in st or "失敗" in st): return st
        await pg.wait_for_timeout(1000)
async def open_details(pg):
    await pg.fill('#search','憲法學講義'); await pg.wait_for_timeout(800)
    await pg.locator('#books .book').first.click(); await pg.wait_for_timeout(800)
async def run(b,logged):
    ctx=await b.new_context(viewport={"width":390,"height":844}); errs=[]
    if logged: await ctx.add_init_script("localStorage.setItem('sb-clcddygkaaqqtsbswgdf-auth-token',JSON.stringify({access_token:'%s',refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001'}}));"%FAKE)
    await ctx.route("**/*",route); pg=await ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
    await pg.goto(BASE); out={'status':await ready(pg)}
    await open_details(pg)
    out['details_has_ask']=await pg.locator('#modalContent [data-action=ask]').count()
    await pg.locator('#modalContent [data-action=ask]').click(); await pg.wait_for_timeout(500)
    out['panel']=(await pg.inner_text('#modalContent'))[:160]
    if logged:
        await pg.fill('#askQuestion','人民代表大會制度與中華民國國會制度有何不同？')
        await pg.click('#modalContent [data-action=askRun]')
        await pg.wait_for_selector('.ask-answer',timeout=60000)
        a=pg.locator('.ask-answer')
        out['label']=await a.locator('.ask-label').inner_text()
        out['table_rows']=await a.locator('table tr').count()
        out['sources']=await a.locator('ul').last.inner_text()
        out['has_page_no']=bool(__import__('re').search(r'第\s*\d+\s*頁',await a.inner_text()))
        g=log['gateway'][-1]; out['gateway_req']={k:g.get(k) for k in ('provider','allowed_providers','agent_id','temperature','max_tokens','thinking')}; out['gateway_calls']=len(log['gateway'])
        out['searches']=log['search']; out['web']=log['web']
        out['table_scroll']=await pg.evaluate("()=>{const t=document.querySelector('.ask-table');return t&&getComputedStyle(t).overflowX}")
        await pg.click('#close'); await pg.wait_for_timeout(300)
        # 閱讀器工具列的提問按鈕
        await open_details(pg); await pg.locator('#modalContent [data-action=read]').click(); await pg.wait_for_timeout(2500)
        rb=pg.locator('#reader [data-action=ask]'); out['reader_btn_visible']=await rb.is_visible()
        await rb.click(); await pg.wait_for_timeout(500)
        out['reader_panel_shows_previous_answer']=await pg.locator('.ask-answer').count()
        out['overlay_on_top']=await pg.evaluate("()=>{const r=document.querySelector('#modalContent').getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+20);return !!e&&!!e.closest('#overlay')}")
    out['errors']=errs; await ctx.close(); return out
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=True,args=["--no-sandbox"])
        for logged in (False,True): print('=== logged' if logged else '=== anonymous'); print(json.dumps(await run(b,logged),ensure_ascii=False,indent=1))
        await b.close()
asyncio.run(main())
