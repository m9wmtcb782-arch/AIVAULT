const FN='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-vision-test';
const TURNS_KEY='aivault_ds_live_turns';
const DRAFT_KEY='aivault_ds_live_draft';
const CTX_KEY='technical_dark_star_live_context';
const VOICES=[['Zephyr','明亮'],['Puck','活漿'],['Charon','資訊型'],['Kore','穩重'],['Fenrir','興奮'],['Leda','年輕'],['Orus','穩重'],['Aoede','輕快'],['Callirrhoe','輕鬆'],['Autonoe','明亮'],['Enceladus','氣聲'],['Iapetus','清晰'],['Umbriel','輕鬆'],['Algieba','順滑'],['Despina','順滑'],['Erinome','清晰'],['Algenib','沙啞'],['Rasalgethi','資訊型'],['Laomedeia','活漿'],['Achernar','柔和'],['Alnilam','穩重'],['Schedar','平穩'],['Gacrux','成熟'],['Pulcherrima','前衛'],['Achird','友善'],['Zubenelgenubi','隨性'],['Vindemiatrix','溫柔'],['Sadachbia','活漿'],['Sadaltager','知識型'],['Sulafat','溫暖']];
let ws=null,stream=null,auto=false,facing='user',mode='video',videoTimer=null,inputCtx=null,processor=null,source=null,playCtx=null,nextPlayTime=0,audioPackets=0,audioBytes=0,reconnecting=false,wanted=false;
let pendingText=[], inBuf='', outBuf='', userEl=null, aiEl=null;
const $=id=>document.getElementById(id);
function log(s){$('log').textContent+='['+new Date().toLocaleTimeString('zh-TW')+'] '+s+'\n';$('log').scrollTop=$('log').scrollHeight}
function status(s){$('status').textContent=s}
function setAutoUi(){const b=$('autoBtn');if(b)b.textContent=auto?'\u23F8 \u505c\u6b62\u81ea\u52d5\u9023\u63a5':'\u26A1 \u81ea\u52d5\u9023\u63a5'}
function scheduleReconnect(){
  if(!auto||!wanted||reconnecting)return;
  reconnecting=true;
  status('\uD83D\uDFE1 \u5df2\u65b7\u7dda\uff0c\u6b63\u5728\u81ea\u52d5\u91cd\u9023\u2026');
  log('\u9023\u7dda\u4e2d\u65b7\uff0c1 \u79d2\u5f8c\u81ea\u52d5\u91cd\u9023');
  setTimeout(()=>{
    reconnecting=false;
    if(!auto||!wanted)return;
    connect().then(()=>{
      if(mode==='video')startVideo();
      if(!processor)startAudio();
      status('\uD83D\uDFE2 \u5df2\u91cd\u9023\uff5c\u53ef\u7e7c\u7e8c\u8aaa\u6216\u6253\u5b57');
    }).catch(()=>scheduleReconnect());
  },1000);
}
function connect(){
  return new Promise((resolve,reject)=>{
    if(ws&&ws.readyState===1)return resolve();
    ws=new WebSocket(FN+'?voice='+encodeURIComponent($('voiceSelect').value));
    ws.binaryType='arraybuffer';
    ws.onopen=()=>{status('\uD83D\uDFE2 \u5df2\u9023\u7dda\uff5c\u53ef\u4ee5\u6253\u5b57\u6216\u8aaa\u8a71');log('WebSocket \u5df2\u9023\u7dda');flushPending();resolve()};
    ws.onerror=e=>reject(e);
    ws.onclose=()=>{ws=null;if(auto&&wanted)scheduleReconnect();else status('\u26AA \u5df2\u65b7\u7dda')};
    ws.onmessage=e=>handleMessage(e.data);
  });
}
