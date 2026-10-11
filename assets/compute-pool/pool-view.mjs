export const SPECIES = {
  phone:{name:'手機',fish:'小魚',size:19,color:'#56dcc3',tool:'魚竿'},
  tablet:{name:'平板',fish:'中魚',size:29,color:'#f8c973',tool:'抄網'},
  computer:{name:'電腦',fish:'大魚',size:40,color:'#70c7fa',tool:'大型抄網'},
  shark:{name:'4090',fish:'鯊魚',size:58,color:'#b1c5e0',tool:'捕撈網'},
  whale:{name:'5090',fish:'鯨魚',size:76,color:'#b0a1ff',tool:'吊網'},
  leviathan:{name:'6000',fish:'巨鯨',size:94,color:'#73d8fa',tool:'起重吊具'},
  unknown:{name:'待辨識',fish:'待辨識魚',size:25,color:'#9faebb',tool:'抄網'},
};
export function classify(node) {
  const gpu=JSON.stringify(node.hardware||{});
  if(/(?:RTX|QUADRO|NVIDIA)[^\d]{0,20}6000\b|\b6000\s*(?:ADA|BLACKWELL)/i.test(gpu))return 'leviathan';
  if(/\b5090\b/.test(gpu))return 'whale';
  if(/\b4090\b/.test(gpu))return 'shark';
  const platform=typeof node.platform==='string'?node.platform:JSON.stringify(node.platform||{});
  if(/iPad|tablet|平板/i.test(platform))return 'tablet';
  if(/iPhone|iPod|Android|mobile|手機/i.test(platform))return 'phone';
  if(/Windows|Mac|Linux|desktop|computer|電腦/i.test(platform))return 'computer';
  return 'unknown';
}
export function waterState(nodes,reference=20) {
  const active=nodes.filter(n=>n.online===true&&n.gpu_reported===true&&!['PAUSED','STOPPED'].includes(String(n.status||'').toUpperCase()));
  const scale=Number.isFinite(Number(reference))&&Number(reference)>0?Number(reference):20;
  const members=nodes.filter(n=>n.online===true);
  const ratio=Math.min(1,members.length/scale);
  return {active,members,ratio,count:active.length,color:ratio<.33?'#fc6374':ratio<.67?'#f5c04d':'#3da6f6',label:ratio<.33?'低水位':ratio<.67?'中水位':'高水位'};
}
export function transitions(previous,current,{truncated=false}={}) {
  if(!previous)return [];
  const now=new Map(current.map(n=>[n.id,n]));
  return previous.filter(n=>n.online===true&&(now.has(n.id)?now.get(n.id).online===false:!truncated));
}
