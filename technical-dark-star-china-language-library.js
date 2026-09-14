/* AIVAULT Technical Dark Star - China Language Library Adapter */
(()=>{
  'use strict';
  if(window.__AIVAULT_CHINA_LANGUAGE_LIBRARY__) return;
  window.__AIVAULT_CHINA_LANGUAGE_LIBRARY__=true;

  /*
   * This is a practical China-language catalog, not a claim that every
   * undocumented village variety is represented. IDs are stable and are
   * accepted by the Dark Star voice relay.
   */
  const catalog=[
    ['beijing','北京話'],['jin','晉語'],['ji_lu','冀魯官話'],['jiao_liao','膠遼官話'],
    ['zhongyuan_mandarin','中原官話'],['lan_yin','蘭銀官話'],['jianghuai_mandarin','江淮官話'],
    ['southwestern_mandarin','西南官話'],['jiangnan_mandarin','江南官話'],['northeastern_mandarin','東北官話'],
    ['jiangxi_mandarin','江西官話'],['hubei_mandarin','湖北官話'],['shaanxi_mandarin','陝西官話'],
    ['shanghainese','上海話'],['suzhou','蘇州話'],['hangzhou','杭州話'],['ningbo','寧波話'],['wenzhou','溫州話'],
    ['shaoxing','紹興話'],['jiaxing','嘉興話'],['huzhou','湖州話'],['taizhou_wu','台州吳語'],['jinhua','金華話'],
    ['quzhou','衢州話'],['lishui','麗水話'],['xuanwu_wu','宣州吳語'],
    ['cantonese','廣東話'],['guangxi_cantonese','廣西粵語'],['taishan','台山話'],['kaiping','開平話'],['hongkong_cantonese','香港粵語'],
    ['taiwanese','台語'],['quanzhou_minnan','泉州閩南語'],['zhangzhou_minnan','漳州閩南語'],['xiamen_minnan','廈門閩南語'],
    ['chaoshan_minnan','潮汕閩南語'],['chaozhou','潮州話'],['shantou','汕頭話'],['leizhou','雷州話'],['hainanese','海南話'],
    ['putian','莆仙話'],['fuqing','福清話'],['fuzhou','福州話'],['mindong','閩東語'],['minbei','閩北語'],['minzhong','閩中語'],
    ['hakka','客家話'],['meixian_hakka','梅縣客家話'],['hakka_huizhou','惠州客家話'],['hakka_gannan','贛南客家話'],
    ['gan','贛語'],['xiang','湘語'],['huizhou','徽語'],['pinghua','平話'],['shaoguan_tuhua','韶關土話'],
    ['sichuan','四川話'],['chongqing','重慶話'],['henan','河南話'],['shandong','山東話'],['tianjin','天津話'],
    ['shaanxi','陝西話'],['shanxi','山西話'],['hubei','湖北話'],['hunan','湖南話'],['jiangxi','江西話'],['anhui','安徽話'],
    ['fujian','福建話'],['hebei','河北話'],['liaoning','遼寧話'],['jilin','吉林話'],['heilongjiang','黑龍江話'],
    ['gansu','甘肅話'],['ningxia','寧夏話'],['qinghai_chinese','青海漢語'],['xinjiang_mandarin','新疆漢語'],
    ['uyghur','維吾爾語'],['kazakh','哈薩克語'],['kyrgyz','吉爾吉斯語'],['tajik','塔吉克語'],['uzbek_china','中國烏茲別克語'],
    ['tatar','塔塔爾語'],['salar','撒拉語'],['dongxiang','東鄉語'],['bonan','保安語'],['tu','土族語'],['mongolian','蒙古語'],
    ['buriat','布里亞特蒙古語'],['manchu','滿語'],['xibe','錫伯語'],['daur','達斡爾語'],
    ['tibetan','藏語'],['tibetan_kham','康巴藏語'],['tibetan_amdo','安多藏語'],['tibetan_utsang','衛藏藏語'],
    ['zhuang','壯語'],['bouyei','布依語'],['dong','侗語'],['miao','苗語'],['yao','瑤語'],['yi','彝語'],['dai','傣語'],
    ['bai','白語'],['naxi','納西語'],['hani','哈尼語'],['lisu','傈僳語'],['lahu','拉祜語'],['wa','佤語'],['jingpo','景頗語'],
    ['achang','阿昌語'],['jingpo_jinghpaw','景頗語（景頗）'],['blang','布朗語'],['pumi','普米語'],['mosuo','摩梭語'],
    ['jinuo','基諾語'],['nu','怒語'],['derung','獨龍語'],['sani','撒尼語'],['southeastern_yi','東南彝語'],
    ['korean_china','中國朝鮮語'],['russian_china','中國俄語'],['burmese','緬甸語']
  ];

  const map=Object.fromEntries(catalog);
  const ids=new Set(catalog.map(x=>x[0]));
  const selected=()=>{try{const v=JSON.parse(localStorage.getItem('aivault_translate_targets')||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const save=v=>localStorage.setItem('aivault_translate_targets',JSON.stringify([...new Set(v)]));

  function addOptions(){
    const list=document.querySelector('#dsTranslateList');
    if(!list) return false;
    for(const [id,label] of catalog){
      if(list.querySelector(`input[value="${CSS.escape(id)}"]`)) continue;
      const row=document.createElement('label');
      row.className='ds-fix-translate-option';
      const input=document.createElement('input');
      input.type='checkbox';input.value=id;input.checked=selected().includes(id);
      input.addEventListener('change',()=>{
        const all=[...list.querySelectorAll('input:checked')].map(x=>x.value);
        if(!all.length){input.checked=true;return;}
        save(all);
      });
      row.append(input,document.createTextNode(label));
      list.appendChild(row);
    }
    const count=document.querySelector('#dsTranslateCount');
    if(count) count.textContent=`已選 ${selected().length||1} 種語言`;
    return true;
  }

  /* Existing voice-fix keeps its own language array. The adapter extends
     the visible selector and persists the selected IDs. */
  const originalWS=window.WebSocket;
  if(originalWS && !window.__AIVAULT_CHINA_WS_PATCH__){
    window.__AIVAULT_CHINA_WS_PATCH__=true;
    window.WebSocket=function(url,protocols){
      try{
        const s=String(url);
        if(s.includes('technical-dark-star-voice-sdk-relay')){
          const u=new URL(s);
          const wanted=selected();
          if(wanted.length) u.searchParams.set('languages',wanted.join(','));
          url=u.toString();
        }
      }catch{}
      return protocols===undefined?new originalWS(url):new originalWS(url,protocols);
    };
    window.WebSocket.prototype=originalWS.prototype;
    for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(window.WebSocket,k,{value:originalWS[k]});
  }

  const timer=setInterval(()=>{if(addOptions())clearInterval(timer)},300);
  setTimeout(addOptions,3000);
  window.AIVAULT_CHINA_LANGUAGE_CATALOG=catalog.map(([id,label])=>({id,label}));
})();
