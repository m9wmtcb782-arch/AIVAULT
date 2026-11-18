import asyncio, json, base64, time, sys
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/dark-star-ebook.html"
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
FAKE=b64({"alg":"HS256","typ":"JWT"})+'.'+b64({"sub":"00000000-0000-4000-8000-000000000001","exp":int(time.time())+3600,"role":"authenticated"})+'.sig'
STUDY={"ok":True,"logged_in":True,"books":[{"ebook_id":"e0bc8c57-646d-474c-988e-d6cb3d4f8972","enabled":True},{"ebook_id":"c8743d50-bad5-4ec8-b675-5e64fe7985a9","enabled":True},{"ebook_id":"c22c6a4a-4339-4143-a1e9-e48a430ce823","enabled":False}]}
FLOOR={"books":[{"id":"9d6c6eb2-4be2-4466-a26f-4a499ecceb18","title":"星海之戀","genre":"愛情","status":"serial","chapters_done":13,"target_chapters":100,"chars":30958},{"id":"b18378c0-91c9-433d-8640-1de7066ed340","title":"暗鏡之城","genre":"推理","status":"serial","chapters_done":13,"target_chapters":100,"chars":37939}],"genres":["愛情","推理"]}
PROG={"e0bc8c57-646d-474c-988e-d6cb3d4f8972":{"have":467,"total":467,"pct":100},"11111111-2222-4333-8444-555555555555":{"have":4,"total":10,"pct":40}}
calls=[]
async def route(r):
    req=r.request; u=req.url
    if 'dark-star-ebook-ingest' in u and req.method=='POST':
        body={}
        try: body=json.loads(req.post_data or '{}')
        except: pass
        if 'feature=floor' in u:
            calls.append('floor:'+str(body.get('action'))); return await r.fulfill(status=200,content_type='application/json',body=json.dumps(FLOOR,ensure_ascii=False))
        if body.get('action')=='study_list':
            calls.append('study_list'); return await r.fulfill(status=200,content_type='application/json',body=json.dumps(STUDY))
        h=dict(req.headers); ak=h.get('apikey'); 
        if ak: h['authorization']='Bearer '+ak   # 其他動作改用匿名身分走真實後端（假 token 不送出）
        return await r.continue_(headers=h)
    return await r.continue_()
async def wait_cat(pg):
    for _ in range(60):
        st=await pg.text_content("#catalogStatus")
        if st and ("遠端" in st or "失敗" in st): return st
        await pg.wait_for_timeout(1000)
async def run(b,logged):
    ctx=await b.new_context(viewport={"width":390,"height":844}); errs=[]
    if logged:
        await ctx.add_init_script("localStorage.setItem('sb-clcddygkaaqqtsbswgdf-auth-token',JSON.stringify({access_token:'%s',refresh_token:'fake-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated'}}));localStorage.setItem('aivault_bookqa_progress_v1',JSON.stringify(%s));"%(FAKE,json.dumps(PROG)))
    await ctx.route("**/*",route)
    pg=await ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
    await pg.goto(BASE); st=await wait_cat(pg); await pg.wait_for_timeout(1500)
    out={'status':st}
    await pg.click('[data-action=learned]'); await pg.wait_for_timeout(1500)
    out['learned']=await pg.inner_text('#modalContent')
    out['learned_buttons']=await pg.evaluate("()=>[...document.querySelectorAll('#modalContent [data-book]')].map(e=>e.textContent)")
    out['placeholders']=await pg.evaluate("()=>document.querySelectorAll('#modalContent .learned-missing').length")
    out['login_link']=await pg.evaluate("()=>document.querySelector('#modalContent .learned-login a')?.getAttribute('href')||null")
    await pg.click('#close'); await pg.wait_for_timeout(300)
    await pg.evaluate("()=>document.querySelector('[data-action=zones]').click()"); await pg.wait_for_timeout(500)
    out['zone_tile']=await pg.evaluate("()=>[...document.querySelectorAll('#modalContent [data-cat=\"3\"], #categories [data-cat=\"3\"]')].map(e=>e.innerText.replace(/\\n/g,' '))")
    await pg.locator('#modalContent [data-cat="3"]').first.click(); await pg.wait_for_timeout(1500)
    out['zone_title']=(await pg.text_content('#currentTitle'),await pg.text_content('#count'))
    out['novel_section']=await pg.evaluate("()=>{const s=document.querySelector('.ai-novels');if(!s)return null;const r=s.querySelector('.ai-novels-entry').getBoundingClientRect();return {text:s.innerText.slice(0,300),entry_href:s.querySelector('.ai-novels-entry').getAttribute('href'),entry_size:[Math.round(r.width),Math.round(r.height)],cards:[...s.querySelectorAll('.ai-novel')].map(a=>a.innerText.replace(/\\n/g,' | ')),empty_hidden:document.getElementById('empty').hidden}}")
    if logged:
        if await pg.locator('.ai-novel').count():
            await pg.locator('.ai-novel').first.click(); await pg.wait_for_load_state(); out['card_nav']=pg.url
    out['calls']=list(calls); out['errors']=errs
    await ctx.close(); return out
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=True,args=["--no-sandbox"])
        for logged in (False,True):
            calls.clear(); print('=== logged' if logged else '=== anonymous'); print(json.dumps(await run(b,logged),ensure_ascii=False,indent=1))
        await b.close()
if __name__=="__main__": asyncio.run(main())
