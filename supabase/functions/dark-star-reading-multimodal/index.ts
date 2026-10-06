const CORS: Record<string,string> = {
  "Access-Control-Allow-Origin":"https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"method"},405);
  let body:{media_type?:string;media?:string;prompt?:string;messages?:unknown[];agent_id?:string}={};
  try{body=await req.json();}catch{return json({success:false,error:"bad_json"},400);}
  const mediaType=String(body.media_type||"").toLowerCase();
  const media=String(body.media||"").trim();
  if(!media||!["image","audio","video"].includes(mediaType))return json({success:false,error:"MEDIA_REQUIRED",allowed:["image","audio","video"]},400);
  const capability=mediaType==="image"?"vision":mediaType;
  const prompt=body.prompt||(
    mediaType==="image"?"你是暗星。請完整理解這張圖片，辨識文字、圖表、人物、場景、結構與重要視覺資訊，並以繁體中文輸出研究導讀所需的內容。":
    mediaType==="audio"?"你是暗星。請完整分析這段音訊。若為語音，理解內容、說話者與重點；若為音樂，分析人聲、樂器、節奏、段落、情緒、歌詞可辨識內容與聲音事件。不得虛構。":
    "你是暗星。請完整理解這段影片的畫面、語音、字幕、事件與時間關係，建立可供研究導讀使用的時間軸分析。不得虛構。"
  );
  const base=Deno.env.get("SUPABASE_URL")||"";
  const upstream=await fetch(base+"/functions/v1/ai-gateway",{method:"POST",headers:{"Content-Type":"application/json",authorization:req.headers.get("authorization")||"",apikey:req.headers.get("apikey")||""},body:JSON.stringify({agent_id:body.agent_id||"technical-dark-star",capability,messages:body.messages||[{role:"user",content:prompt,media_type:mediaType,media}],media})});
  const data=await upstream.json().catch(()=>({}));
  return json({success:upstream.ok&&data.success!==false,function:"dark-star-reading-multimodal",media_type:mediaType,capability,upstream_status:upstream.status,status:upstream.ok?"NOT_VERIFIED":"FAILED",result:data},upstream.ok?200:upstream.status);
});