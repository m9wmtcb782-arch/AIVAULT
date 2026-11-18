# 手機尺寸（390x844）：「📋 複製問題給 Grok／GPT」— 匿名（中華民國憲法，有純文字版）＋登入（憲法學講義，無純文字版→附段落，photo-solve 以假資料攔截）
import asyncio, json, base64, time, sys, re
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/dark-star-ebook.html"
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
FAKE=b64({"alg":"HS256","typ":"JWT"})+'.'+b64({"sub":"00000000-0000-4000-8000-000000000001","exp":int(time.time())+3600,"role":"authenticated"})+'.sig'
log={'search':0,'gateway':0}
async def route(r):
    req=r.request; u=req.url
    if 'ai-gateway' in u: log['gateway']+=1; return await r.fulfill(status=500,body='{}')
    if 'feature=photo-solve' in u and req.method=='POST':
        log['search']+=1
        return await r.fulfill(status=200,content_type='application/json',body=json.dumps({"ok":True,"sources":[{"ebook_id":"x","page_number":5,"excerpt":"人民代表大会是国家权力机关。","score":5}]},ensure_ascii=False))
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
async def case(b,logged,query,question):
    ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True); errs=[]
    await ctx.grant_permissions(["clipboard-read","clipboard-write"],origin=BASE.split('/dark')[0])
    if logged: await ctx.add_init_script("localStorage.setItem('sb-clcddygkaaqqtsbswgdf-auth-token',JSON.stringify({access_token:'%s',refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001'}}));"%FAKE)
    await ctx.route("**/*",route); pg=await ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
    if query.startswith('id:'):
        await pg.goto(BASE+'?book='+query[3:]); out={'status':await ready(pg)}; await pg.wait_for_timeout(2500)
        await pg.locator('#reader [data-action=ask]').click(); await pg.wait_for_timeout(400)
    else:
        await pg.goto(BASE); out={'status':await ready(pg)}
        await pg.fill('#search',query); await pg.wait_for_timeout(800)
        await pg.locator('#books .book').first.click(); await pg.wait_for_timeout(800)
        await pg.locator('#modalContent [data-action=ask]').click(); await pg.wait_for_timeout(400)
    btn=pg.locator('#modalContent [data-action=askCopy]'); out['copy_btn_visible']=await btn.is_visible()
    out['btn_box']=await btn.bounding_box()
    await pg.fill('#askQuestion',question); await btn.click()
    await pg.wait_for_function("()=>/已複製|無法自動複製/.test(document.querySelector('#askCopyStatus')?.textContent||'')",timeout=30000)
    out['copy_status']=await pg.text_content('#askCopyStatus')
    clip=await pg.evaluate("navigator.clipboard.readText()"); out['clipboard_len']=len(clip)
    out['textarea_same']=(await pg.input_value('#askCopyText'))==clip
    out['urls']=re.findall(r'https?://\S+',clip)
    out['no_h_overflow']=await pg.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1")
    out['clip_head']=clip[:200]; out['has_excerpt']='人民代表大会是国家权力机关' in clip; out['no_page_rule']='不要寫頁碼' in clip; out['errors']=errs; out['search_calls']=log['search']; out['gateway_calls']=log['gateway']
    await ctx.close(); return out
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=True,args=["--no-sandbox"])
        print(json.dumps(await case(b,False,'id:a14fa90b-3d9e-415a-aad2-bf7499444c8a','言論自由在憲法上如何保障？'),ensure_ascii=False,indent=1))
        print(json.dumps(await case(b,True,'憲法學講義','人民代表大會制度與中華民國國會制度有何不同？'),ensure_ascii=False,indent=1))
        print(json.dumps(await case(b,True,'id:28b34c97-53b6-4819-9009-35847a5dea91','德國基本法對人性尊嚴的保障與中華民國有何不同？'),ensure_ascii=False,indent=1))
        await b.close()
asyncio.run(main())
