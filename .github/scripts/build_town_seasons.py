# 由 town_seasons.src.js + 官方資料（data/）產生 town_seasons.js（ss1）
import json
src=open('.github/scripts/town_seasons.src.js',encoding='utf-8').read()
hol=json.load(open('data/tw-holidays-dgpa-2026-2027.json',encoding='utf-8'));ty=json.load(open('data/typhoon-names-cwa-2026.json',encoding='utf-8'))
out=src.replace('__HOL__',json.dumps(hol,ensure_ascii=False,separators=(',',':'))).replace('__TYN__',json.dumps(ty,ensure_ascii=False,separators=(',',':')))
open('.github/scripts/town_seasons.js','w',encoding='utf-8').write(out);print('town_seasons.js',len(out))
