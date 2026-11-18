import json,re
u=json.load(open('units.json'))
MAXC=900
def split_text(t):
    # split a unit's text into chunks <= MAXC at line boundaries (long lines at sentence/space)
    out=[];cur=''
    for line in t.split('\n'):
        while len(line)>MAXC:
            cut=line.rfind(' ',0,MAXC)
            if cut<MAXC//2: cut=MAXC
            seg,line=line[:cut],line[cut:].lstrip()
            if cur: out.append(cur); cur=''
            out.append(seg)
        if len(cur)+len(line)+1>MAXC and cur:
            out.append(cur); cur=line
        else: cur=(cur+'\n'+line) if cur else line
    if cur: out.append(cur)
    return out
# Build pages per unit: hierarchy headings start a new page; sections pack.
VOL_TARGET=1500
items=[]
for i,x in enumerate(u):
    items.append(x)
# Volume splitting at chapter/subchapter/subtitle boundaries
vols=[];cur=[];curc=0
for x in u:
    if x['kind'] in('subtitle','chapter','subchapter','part') and curc>VOL_TARGET*MAXC*0.75:
        vols.append(cur); cur=[]; curc=0
    cur.append(x); curc+=len(x['text'])
vols.append(cur)
def pages_of(units):
    pages=[];cur='';toc=[]
    for x in units:
        if x['kind']!='section':
            if cur: pages.append(cur); cur=''
            lvl={'title':'part','subtitle':'part','chapter':'chapter'}.get(x['kind'],'chapter')
            toc.append(dict(level=lvl,title=x['text'],page_number=len(pages)+1))
            cur=x['text']; continue
        chunks=split_text(x['text'])
        head=x['text'].split('\n')[0][:120]
        first=True
        for c in chunks:
            if len(cur)+len(c)+2>MAXC and cur:
                pages.append(cur); cur=c
            else: cur=(cur+'\n\n'+c) if cur else c
            if first: toc.append(dict(level='article',title=head,page_number=len(pages)+1)); first=False
    if cur: pages.append(cur)
    return pages,toc
for i,v in enumerate(vols):
    p,t=pages_of(v)
    first=[x['text'] for x in v if x['kind']!='section'][:1]
    secs=[x['id'].split('/s')[-1] for x in v if x['kind']=='section']
    print(i+1,len(p),sum(len(x) for x in p),len(secs),secs[0],secs[-1],first, max(len(x) for x in p))

import uuid,hashlib,gzip
ZSHA=hashlib.sha256(open('xml_usc26.zip','rb').read()).hexdigest()
NSU=uuid.UUID('6f1c2a7e-26c0-4d6e-9a26-000000000026')
N=len(vols)
allsec=[x for x in u if x['kind']=='section']
volinfo=[]
for i,v in enumerate(vols):
    secs=[x for x in v if x['kind']=='section']
    volinfo.append(dict(n=i+1,first=secs[0]['id'].split('/s')[-1],last=secs[-1]['id'].split('/s')[-1],nsec=len(secs)))
out=[]
for i,v in enumerate(vols):
    vi=volinfo[i]
    eid='eabac26d-1725-4284-a754-871f72910fdc' if i==0 else str(uuid.uuid5(NSU,f'usc26-119-142-vol{i+1}'))
    p,t=pages_of(v)
    # path at volume start
    first=v[0]; path=' ＞ '.join(first['path'].values()) if first.get('path') else ''
    vols_list='\n'.join(f"　第{x['n']}冊：§ {x['first']} – § {x['last']}（{x['nsec']} 條）" for x in volinfo)
    intro=f"""【出處與授權說明】
書名：美國法典第26編 國內稅收法 United States Code Title 26（Internal Revenue Code）第{i+1}冊／共{N}冊
本冊範圍：§ {vi['first']} – § {vi['last']}，共 {vi['nsec']} 條（含已廢止、重編號、保留等條次之狀態行）
本冊起點所屬架構：{path}
編纂機關：Office of the Law Revision Counsel（OLRC），U.S. House of Representatives
版本：Release point 119-142（current through Public Law 119-142，2026-11-10）
來源檔：OLRC 官方 USLM XML（xml_usc26@119-142.zip，sha256 {ZSHA[:16]}…），取自 uscode.house.gov 官方下載區
授權：美國聯邦政府著作，依 17 U.S.C. §105 屬公共領域
收錄範圍：每條條文全文（含各款目、表格）、立法沿革（Source Credit）及條文註腳；未收錄 OLRC 編輯附註（Editorial Notes／Amendments／Effective Date 等註釋）
全編條數核對：XML 共 2,162 條次（現行 1,900、已廢止 241、重編號 17、保留 2、省略 2），與官方 PDF 版（pdf_usc26@119-142）條次標題核對一致
全套冊次：
{vols_list}
說明：本電子書為官方文字轉檔，頁碼與官方紙本不同；引用時以官方版本為準。本書內容非法律意見。"""
    pages=[intro]+p
    toc=[dict(level='part',title=f'出處與授權說明（第{i+1}冊）',page_number=1)]+[dict(x,page_number=x['page_number']+1) for x in t]
    for k,x in enumerate(toc): x['ordinal']=k; x['title']=x['title'][:300]
    rows=[dict(page_number=k+1,content=c,word_count=len(c)) for k,c in enumerate(pages)]
    title=f"美國法典第26編 國內稅收法 United States Code Title 26（IRC）｜第{i+1}冊／共{N}冊（§{vi['first']}–§{vi['last']}）"
    desc=f"7 比較法/國際｜美國聯邦政府著作，public domain（17 U.S.C. §105）｜OLRC 官方 USLM XML release point 119-142 轉檔｜本冊 § {vi['first']}–§ {vi['last']}，{vi['nsec']} 條｜全套 {N} 冊、2,162 條次"
    md5=hashlib.md5(''.join(r['content'] for r in rows).encode()).hexdigest()
    out.append(dict(ebook_id=eid,volume=i+1,title=title,description=desc,pages=rows,toc=toc,total_pages=len(rows),total_characters=sum(r['word_count'] for r in rows),content_md5=md5,sections=vi['nsec']))
    print(i+1,eid,len(rows),out[-1]['total_characters'],len(toc),title)
import os
os.makedirs('build',exist_ok=True)
for o in out:
    with gzip.open(f"build/usc26_vol{o['volume']:02d}.json.gz",'wt',encoding='utf-8') as f: json.dump(o,f,ensure_ascii=False)
json.dump(dict(release='119-142',zip_sha256=ZSHA,volumes=[{k:o[k] for k in('ebook_id','volume','title','total_pages','total_characters','content_md5','sections')} for o in out],sections_total=len(allsec)),open('build/manifest.json','w'),ensure_ascii=False,indent=1)
