# 產生 digital-human-real/zh-viseme.js 的 T 表（需 pypinyin）。注意：會覆寫整檔，alignFrames 需再補回；僅供重建對照表參考。
from pypinyin import pinyin, Style
chars=set()
for hi in range(0xB0,0xD8):
  for lo in range(0xA1,0xFF):
    try: chars.add(bytes([hi,lo]).decode('gb2312'))
    except: pass
for hi in range(0xA4,0xC7):
  for lo in list(range(0x40,0x7F))+list(range(0xA1,0xFF)):
    try: chars.add(bytes([hi,lo]).decode('big5'))
    except: pass
def cls(f):
  f=f.replace('v','ü')
  if f in('i','in','ing','ie','ei','ian','üe','ue','uei','ui','üan'): return 'ei'
  if f in('o','uo','ou','iou','iu','u','ü','ong','iong','un','ün','uen','ueng'): return 'u'
  if 'a' in f: return 'a'
  return 'e'
out={'a':[],'ei':[],'u':[]}
for c in sorted(chars):
  p=pinyin(c,style=Style.FINALS,strict=True,heteronym=False)[0][0]
  if not p: continue
  n=pinyin(c,style=Style.NORMAL)[0][0]
  import re
  k='e' if (p=='i' and re.match(r'^(zh|ch|sh|r|z|c|s)i$',n)) else cls(p)
  if k in out: out[k].append(c)
import json
js='''/* 中文字→整頭嘴型（啊 a／婀 e／欸 ei／嗚 u）離線對照表。由 pypinyin 韻母自動產生（GB2312 一級＋Big5 常用字）；表外字預設 e（婀）。 */
(function (root) {
  const T = %s;
  const M = {};
  for (const k in T) for (const ch of T[k]) M[ch] = k;
  const PUNCT = /[，。！？、,.!?;；:：…—\\-「」『』（）()\\s"'“”‘’~～]/;
  function charVis(ch) {
    if (!ch || PUNCT.test(ch)) return '';
    const c = ch.toLowerCase();
    if (/[a-z]/.test(c)) return c === 'a' ? 'a' : /[ei y]/.test(c) ? 'ei' : /[ouw]/.test(c) ? 'u' : 'e';
    if (/[0-9]/.test(c)) return 'ei';
    if (/[\\u3400-\\u9fff]/.test(ch)) return M[ch] || 'e';
    return '';
  }
  // 文字→音節序列：每個中文字一個音節；英文單字取第一個母音；標點＝停頓（''）
  function textToVisemes(text) {
    const out = [];
    const s = String(text || '');
    const re = /[A-Za-z]+|[0-9]|[\\s\\S]/g; let m;
    while ((m = re.exec(s))) {
      const t = m[0];
      if (/^[A-Za-z]+$/.test(t)) { const v = (t.toLowerCase().match(/[aeiou]/) || ['e'])[0]; out.push(v === 'a' ? 'a' : (v === 'o' || v === 'u') ? 'u' : v === 'i' ? 'ei' : 'e'); continue; }
      if (/\\s/.test(t)) continue;
      out.push(charVis(t));
    }
    return out;
  }
  const api = { charVis, textToVisemes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DHZhViseme = api;
})(typeof window !== 'undefined' ? window : globalThis);
'''%json.dumps({k:''.join(v) for k,v in out.items()},ensure_ascii=False)
open('/workspace/wt-dawn3/digital-human-real/zh-viseme.js','w').write(js)
print({k:len(v) for k,v in out.items()}, len(chars))
