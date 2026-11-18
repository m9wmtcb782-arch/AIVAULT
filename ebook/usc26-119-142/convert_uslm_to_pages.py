from lxml import etree
import re,json,collections
NS='{http://xml.house.gov/schemas/uslm/1.0}'
def L(e):
    return etree.QName(e).localname if isinstance(e.tag,str) else ''
BLOCK={'subsection':1,'paragraph':2,'subparagraph':3,'clause':4,'subclause':5,'item':6,'subitem':7,'subsubitem':8}
SKIP={'notes','note','toc','layout','sourceCredit'}
FOOT=[]
def txt(e):
    return inline(e)
def inline(e):
    parts=[]
    if e.text: parts.append(e.text)
    for c in e:
        n=L(c)
        if n=='ref' and c.get('class')=='footnoteRef':
            parts.append('[註'+''.join(c.itertext()).strip()+']')
            if c.tail: parts.append(c.tail)
            continue
        if n=='note' and c.get('type')=='footnote':
            FOOT.append(norm(''.join(c.itertext())))
            if c.tail: parts.append(c.tail)
            continue
        if n in SKIP or n in BLOCK or n in('chapeau','content','continuation','p','table'): 
            pass
        if n not in SKIP and n not in BLOCK and n not in('table',):
            parts.append(inline(c))
        elif n=='table':
            parts.append('\n'+table(c)+'\n')
        if c.tail: parts.append(c.tail)
    return ''.join(parts)
def table(t):
    rows=[]
    for tr in [x for x in t.iter() if L(x)=='tr']:
        cells=[re.sub(r'\s+',' ',''.join(td.itertext())).strip() for td in tr if isinstance(td.tag,str)]
        if any(cells): rows.append('｜'.join(cells))
    return '\n'.join(rows)
def norm(s): return re.sub(r'[ \t\u00a0]+',' ',s).strip()
def block(e,depth,out):
    n=L(e)
    ind='　'*depth
    head=''
    num=e.find(NS+'num'); hd=e.find(NS+'heading')
    if num is not None: head+=norm(inline(num))+' '
    if hd is not None: head+=norm(inline(hd))
    line=head.strip()
    pending=line
    for c in e:
        cn=L(c)
        if cn in('num','heading') or cn in SKIP: continue
        if cn in BLOCK:
            if pending: out.append(ind+pending); pending=''
            block(c,depth+1,out)
        elif cn in('chapeau','content','continuation','p'):
            txt=norm(inline(c)) if cn!='content' else None
            if cn=='content':
                # content may contain p blocks
                ps=[x for x in c if L(x)=='p']
                if ps:
                    t0=norm(c.text or '')
                    if pending and hd is None: out.append(ind+(pending+' '+t0).strip()); pending=''
                    else:
                        if pending: out.append(ind+pending); pending=''
                        if t0: out.append(ind+t0)
                    for x in ps: out.append(ind+norm(inline(x)))
                    continue
                txt=norm(inline(c))
            if pending and hd is None: out.append(ind+(pending+' '+(txt or '')).strip()); pending=''; continue
            if pending: out.append(ind+pending); pending=''
            if txt: out.append(ind+txt)
        elif cn=='table':
            if pending: out.append(ind+pending); pending=''
            out.append(table(c))
        elif cn in ('section',):
            pass
    if pending: out.append(ind+pending)
tree=etree.parse('usc26.xml'); main=tree.getroot().find(NS+'main')
HIER={'title','subtitle','chapter','subchapter','part','subpart'}
units=[]  # list of dict(kind, path, text, sec_id)
path={}
order=['title','subtitle','chapter','subchapter','part','subpart']
def walk(e):
    n=L(e)
    if n in HIER:
        num=norm(''.join(e.find(NS+'num').itertext())) if e.find(NS+'num') is not None else ''
        hd=norm(''.join(e.find(NS+'heading').itertext())) if e.find(NS+'heading') is not None else ''
        path[n]=f'{num} {hd}'.strip()
        for k in order[order.index(n)+1:]: path.pop(k,None)
        units.append(dict(kind=n,text=f'{num} {hd}'.strip(),path=dict(path)))
        for c in e:
            if L(c) in HIER or L(c)=='section': walk(c)
    elif n=='section':
        out=[]; FOOT.clear()
        block(e,0,out)
        sc=e.find(NS+'sourceCredit')
        if sc is not None: out.append(norm(''.join(sc.itertext())))
        for f in FOOT:
            m=re.match(r'^\s*(\S+?)[\s\u202f]+(.*)$',f,re.S); out.append('註'+(m.group(1)+'：'+m.group(2) if m else f))
        units.append(dict(kind='section',id=e.get('identifier'),status=e.get('status'),text='\n'.join(x for x in out if x.strip()),path=dict(path)))
walk(main.find(NS+'title'))
secs=[u for u in units if u['kind']=='section']
print('units',len(units),'sections',len(secs),'chars',sum(len(u['text']) for u in units))
json.dump(units,open('units.json','w'),ensure_ascii=False)
by=collections.defaultdict(int)
for u in secs: by[u['path'].get('subtitle')]+=len(u['text'])
for k,v in by.items(): print(k,v)
print(secs[0]['text'][:1200]); print('...'); print([u for u in secs if u['id']=='/us/usc/t26/s61'][0]['text'][:1200])
