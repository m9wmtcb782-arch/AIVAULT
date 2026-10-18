# ss1：每 30 分鐘把台灣真實天氣寫進 aivault_town_weather（id=1）。不輸出金鑰。
# 來源：中央氣象署開放資料（需免費授權碼 secrets.CWA_API_KEY；沒有就跳過，不造假）＋ RSMC 東京（JMA）西北太平洋現有颱風（免費、免金鑰）。
import json, os, urllib.request, urllib.parse, datetime
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]; KEY=os.environ.get("CWA_API_KEY","").strip()
def get(url):
    r=urllib.request.Request(url,headers={"User-Agent":"aivault-town-weather"})
    with urllib.request.urlopen(r,timeout=40) as f: return json.loads(f.read())
def sql(q):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/database/query"%REF,data=json.dumps({"query":q}).encode(),headers={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json","User-Agent":"aivault-town-weather"},method="POST")
    with urllib.request.urlopen(r,timeout=60) as f: return json.loads(f.read() or b"null")
sql(open("supabase/migrations/20261018110000_aivault_town_weather.sql").read())
prev=(sql("select data from public.aivault_town_weather where id=1") or [{}])
prev=(prev[0] or {}).get("data") or {} if prev else {}
data={"fetched_at":datetime.datetime.utcnow().isoformat()+"Z","off":bool(prev.get("off",False)),"cwa_key":bool(KEY),"taipei":None,"cwa_warning":None,"typhoons":[],"sources":[]}
# 1) RSMC 東京：西北太平洋現有颱風（真實名稱）
try:
    lst=get("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json"); ty=[]
    for t in lst[:6]:
        s=get("https://www.jma.go.jp/bosai/typhoon/data/%s/specifications.json"%t["tropicalCyclone"])
        nm=(s[0].get("name") or {}).get("en") if s else None
        pos=next((x.get("position",{}).get("deg") for x in s if isinstance(x.get("part"),dict) and x["part"].get("en")=="Analysis"),None)
        if nm: ty.append({"name_en":nm,"num":t.get("typhoonNumber"),"category":t.get("category"),"pos":pos})
    data["typhoons"]=ty; data["sources"].append("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json")
    if ty: data["latest_name_en"]=sorted(ty,key=lambda x:int(x["num"] or 0))[-1]["name_en"]
    elif prev.get("latest_name_en"): data["latest_name_en"]=prev["latest_name_en"]
except Exception as e: print("jma fail",type(e).__name__); data["latest_name_en"]=prev.get("latest_name_en")
# 2) 中央氣象署（需授權碼）
if KEY:
    base="https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
    try:  # 臺北測站 466920 即時觀測
        d=get(base+"O-A0003-001?"+urllib.parse.urlencode({"Authorization":KEY,"StationId":"466920"}))
        st=d["records"]["Station"][0]; we=st["WeatherElement"]
        def num(v):
            try: v=float(v); return None if v<=-90 else v
            except Exception: return None
        data["taipei"]={"station":st.get("StationName"),"obs_time":st["ObsTime"]["DateTime"],"temp":num(we.get("AirTemperature")),"wx":we.get("Weather"),"rain_mm":num((we.get("Now") or {}).get("Precipitation")) or 0}
        data["sources"].append("CWA O-A0003-001 466920")
    except Exception as e: print("cwa obs fail",type(e).__name__)
    try:  # 颱風警報（W-C0034-005 颱風消息與警報）
        d=get(base+"W-C0034-005?"+urllib.parse.urlencode({"Authorization":KEY}))
        rec=d.get("records") or {}; tys=((rec.get("tropicalCyclones") or {}).get("tropicalCyclone")) or []
        warn=None
        for t in tys:
            nm_en=t.get("typhoonName") or ""; nm_zh=t.get("cwaTyphoonName") or ""
            if nm_en or nm_zh: warn={"active":True,"name_en":nm_en.title(),"name_zh":nm_zh,"type":"CWA W-C0034-005"}; break
        data["cwa_warning"]=warn or {"active":False}
        data["sources"].append("CWA W-C0034-005")
    except Exception as e: print("cwa warn fail",type(e).__name__)
else:
    print("CWA_API_KEY 未設定：只寫入 JMA 颱風資料；台北即時天氣改用日期模擬（畫面會標示）")
tag="$tw$"; js=json.dumps(data,ensure_ascii=False); assert tag not in js
sql("insert into public.aivault_town_weather(id,data,updated_at) values (1,%s%s%s::jsonb,now()) on conflict (id) do update set data=excluded.data, updated_at=now()"%(tag,js,tag))
print("ok typhoons=%d taipei=%s warning=%s"%(len(data["typhoons"]),bool(data["taipei"]),(data["cwa_warning"] or {}).get("active")))
