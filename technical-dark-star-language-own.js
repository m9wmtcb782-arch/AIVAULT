/* Dark Star language menu only. */
(()=>{
 if(window.__DARK_STAR_LANGUAGE_OWN__)return;
 window.__DARK_STAR_LANGUAGE_OWN__=true;
 const KEY="darkStarLanguage";
 const items=[["zh-Hant","繁體中文"],["zh-Hans","简体中文"],["en","English"],["ja","日本語"],["ko","한국어"]];
 function mount(){
  const panel=document.getElementById("darkStarSettingsPanel");
  if(!panel||document.getElementById("darkStarLanguageSelect"))return false;
  const label=document.createElement("div");
  label.id="darkStarLanguageLabel";
  label.textContent="暗星翻譯";
  label.style.cssText="font-size:12px;color:#555;margin:8px 0 2px";
  const select=document.createElement("select");
  select.id="darkStarLanguageSelect";
  select.className="drawer-voice-select";
  items.forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;select.appendChild(o)});
  select.value=localStorage.getItem(KEY)||"zh-Hant";
  select.onchange=()=>localStorage.setItem(KEY,select.value);
  panel.appendChild(label);
  panel.appendChild(select);
  return true;
 }
 setInterval(mount,400);
})();
