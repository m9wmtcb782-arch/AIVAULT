export const SPECIES = {
  phone:{name:'GPU I',fish:'小魚',size:19,color:'#56dcc3',tool:'魚竿'},
  tablet:{name:'GPU II',fish:'中魚',size:29,color:'#f8c973',tool:'抄網'},
  computer:{name:'GPU III',fish:'大魚',size:40,color:'#70c7fa',tool:'大型抄網'},
  shark:{name:'GPU IV',fish:'鯊魚',size:58,color:'#b1c5e0',tool:'捕撈網'},
  whale:{name:'GPU V',fish:'鯨魚',size:76,color:'#b0a1ff',tool:'吊網'},
  leviathan:{name:'GPU VI',fish:'巨鯨',size:94,color:'#73d8fa',tool:'起重吊具'},
  unknown:{name:'算力待測',fish:'待測魚',size:25,color:'#9faebb',tool:'抄網'},
};
// Aquarium tiers are presentation categories, not measured performance or payout weights.
function platformText(node){return typeof node.platform==='string'?node.platform:JSON.stringify(node.platform||{});}
export function deviceLabel(node){
 const p=platformText(node),h=JSON.stringify(node.hardware||{});
 if(/iPhone|iPad|iPod|Macintosh|MacBook|Mac mini|Mac Studio|Mac Pro|iMac|\bMac\b|Apple/i.test(p+' '+h))return 'iOS';
 if(/tablet|平板/i.test(p))return '平板';
 if(/Android|mobile|手機/i.test(p))return '手機';
 if(/Windows|Linux|desktop|computer|電腦/i.test(p)||/RTX|QUADRO|NVIDIA/i.test(h))return '電腦';
 return '待辨識';
}
export function classify(node) {
 if(node.gpu_reported===false)return 'unknown';
 const r=node.gpu_rating;
 if(!r||r.version!=='pool-u32-v1'||!Number.isFinite(r.units)||r.units<=0)return 'unknown';
 // Exactly the same thresholds for every phone, tablet, PC and Apple device.
 if(r.units<1)return 'phone';
 if(r.units<10)return 'tablet';
 if(r.units<100)return 'computer';
 if(r.units<500)return 'shark';
 if(r.units<1000)return 'whale';
 return 'leviathan';
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
