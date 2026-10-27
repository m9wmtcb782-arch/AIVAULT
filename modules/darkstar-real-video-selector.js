// Real Dark Star footage only. Every path below is an existing original guide MP4.
// Never use procedural stick figures or the unrendered greeting-100 catalog.
export const REAL_DARKSTAR_CLIPS=Object.freeze({
 greet:['intro','bow'],
 friendly:['intro','point'],
 attentive:['ask','point'],
 thoughtful:['explain','ask'],
 neutral:['idle']
});
export function chooseRealDarkStarClip(context,{recent=[],available=['idle','intro','point','walk','explain','ask','bow','talk']}={}){
 const pool=(REAL_DARKSTAR_CLIPS[context]||REAL_DARKSTAR_CLIPS.neutral).filter(n=>available.includes(n));
 if(!pool.length)return null;
 return pool.find(n=>!recent.includes(n))||pool[0];
}
