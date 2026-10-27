/**
 * 100 distinct greeting shot briefs, not 100 rendered MP4 files.
 * Asset URLs are null until actual verified clips are produced.
 * Identity lock: use existing Dark Star face and wardrobe; no substitutions.
 */
const styles=['溫柔','活潑','優雅','親切','正式','俏皮','安靜','熱情','沉穩','關懷'];
const gestures=[
 {key:'single_wave',name:'右手輕揮',start:'seated-neutral',end:'seated-neutral',base:'guide_intro'},
 {key:'double_wave',name:'雙手小幅揮動',start:'standing-neutral',end:'standing-neutral',base:null},
 {key:'nod_smile',name:'點頭後微笑',start:'seated-neutral',end:'seated-neutral',base:'guide_intro'},
 {key:'hand_heart',name:'手放胸前致意',start:'standing-neutral',end:'standing-neutral',base:null},
 {key:'head_tilt',name:'微側頭並注視',start:'seated-neutral',end:'seated-neutral',base:'guide_talk'},
 {key:'rise_greet',name:'從座位起身歡迎',start:'seated-neutral',end:'standing-neutral',base:null},
 {key:'small_bow',name:'站姿輕鞠躬',start:'standing-neutral',end:'standing-neutral',base:'guide_bow'},
 {key:'open_palm',name:'攤掌邀請坐下',start:'standing-neutral',end:'standing-neutral',base:'guide_point'},
 {key:'finger_wave',name:'手指小幅擺動',start:'seated-neutral',end:'seated-neutral',base:null},
 {key:'look_up',name:'抬眼微笑致意',start:'seated-neutral',end:'seated-neutral',base:'guide_idle'}
];
export const GREETING_100=Object.freeze(styles.flatMap((style,i)=>gestures.map((gesture,j)=>Object.freeze({
 id:'greeting_'+String(i*10+j+1).padStart(3,'0'),
 style,gesture:gesture.key,description:style+'：'+gesture.name,
 startPose:gesture.start,endPose:gesture.end,
 durationTargetSeconds:1.6+(j%4)*.35,
 voiceTone:style,spokenText:null, // speech generated separately; never baked into MP4
 mp4:null,renderStatus:'NOT_RENDERED',
 referenceClip:gesture.base?('digital-human-real/guide/'+gesture.base+'.mp4'):null,
 identityLock:'darkstar-original',requiresHumanReview:true
}))));
export function chooseGreetingClip({style,pose='seated-neutral',recent=[],assets=GREETING_100}={}){
 const candidates=assets.filter(x=>x.mp4&&x.renderStatus==='VERIFIED'&&x.startPose===pose&&(!style||x.style===style));
 if(!candidates.length)return {status:'NO_VERIFIED_MATCH',clip:null};
 const filtered=candidates.filter(x=>!recent.includes(x.id));
 const pool=filtered.length?filtered:candidates;
 const chosen=pool[0]; // deterministic, no random/AI claim
 return {status:'READY',clip:chosen};
}
