/* Dark Star anatomical joint registry v0.1
 * Anatomical inventory, not an invented 360-joint atlas.
 * Each named entry is independently addressable. Unsupported joints remain uncalibrated.
 * ROM values are NOT inferred. A null ROM prohibits motor actuation.
 */
const records=[];
function add(region,name,side,type,axes=[],coupled=[]){
 const id='DSJ-'+String(records.length+1).padStart(3,'0');
 records.push({id,region,name,side,type,axes:axes.map(axis=>({axis,romDegrees:null,verified:false})),
 coupled, motorEnabled:false,nociceptionEnabled:true,reflexEnabled:true,
 calibration:'REQUIRES_ANATOMICAL_VALIDATION'});
}
const bilateral=(region,name,type,axes=[],coupled=[])=>{for(const side of ['left','right'])add(region,name,side,type,axes,coupled)};
for(const name of ['coronal suture','sagittal suture','lambdoid suture','frontal suture'])add('skull',name,'midline','fibrous-fixed');
for(const name of ['temporomandibular'])bilateral('head',name,'synovial-complex',['opening','translation','lateral']);
add('spine','atlanto-occipital','midline','synovial',['flexion','lateral']);
add('spine','atlanto-axial','midline','synovial',['rotation']);
for(let i=2;i<=6;i++)add('spine',`cervical C${i}-C${i+1} segment`,'midline','composite',['flexion','lateral','rotation']);
add('spine','cervicothoracic C7-T1 segment','midline','composite',['flexion','lateral','rotation']);
for(let i=1;i<=11;i++)add('spine',`thoracic T${i}-T${i+1} segment`,'midline','composite',['flexion','lateral','rotation']);
for(let i=1;i<=4;i++)add('spine',`lumbar L${i}-L${i+1} segment`,'midline','composite',['flexion','lateral','rotation']);
add('spine','lumbosacral L5-S1','midline','composite',['flexion','lateral','rotation']);
for(let rib=1;rib<=12;rib++)bilateral('thorax',`costovertebral rib ${rib}`,'synovial-small',['glide']);
for(let rib=1;rib<=10;rib++)bilateral('thorax',`costotransverse rib ${rib}`,'synovial-small',['glide']);
for(let rib=1;rib<=7;rib++)bilateral('thorax',`sternocostal rib ${rib}`,rib===1?'cartilaginous':'synovial-small',rib===1?[]:['glide']);
for(const name of ['sternoclavicular','acromioclavicular','glenohumeral','humeroulnar','humeroradial','proximal radioulnar','distal radioulnar','radiocarpal','midcarpal'])bilateral('upper-limb',name,'synovial',['flexion','abduction','rotation']);
for(let finger=1;finger<=5;finger++){
 bilateral('hand',`carpometacarpal digit ${finger}`,'synovial',['flexion','abduction']);
 bilateral('hand',`metacarpophalangeal digit ${finger}`,'synovial',['flexion','abduction']);
 if(finger===1)bilateral('hand','thumb interphalangeal','hinge',['flexion']);
 else {bilateral('hand',`proximal interphalangeal digit ${finger}`,'hinge',['flexion']);bilateral('hand',`distal interphalangeal digit ${finger}`,'hinge',['flexion']);}
}
for(const name of ['sacroiliac','hip','tibiofemoral','patellofemoral','proximal tibiofibular','distal tibiofibular','talocrural','subtalar','talonavicular','calcaneocuboid'])bilateral('lower-limb',name,'complex',['flexion','abduction','rotation']);
for(let digit=1;digit<=5;digit++){
 bilateral('foot',`tarsometatarsal digit ${digit}`,'synovial-small',['glide']);
 bilateral('foot',`metatarsophalangeal digit ${digit}`,'synovial',['flexion','abduction']);
 if(digit===1)bilateral('foot','hallux interphalangeal','hinge',['flexion']);
 else {bilateral('foot',`proximal interphalangeal digit ${digit}`,'hinge',['flexion']);bilateral('foot',`distal interphalangeal digit ${digit}`,'hinge',['flexion']);}
}
add('pelvis','pubic symphysis','midline','cartilaginous-small');
export const ANATOMICAL_JOINTS=Object.freeze(records.map(r=>Object.freeze(r)));
export const TARGET_RECORD_COUNT=360;
export const COVERAGE=Object.freeze({target:TARGET_RECORD_COUNT,documented:records.length,
 remaining:Math.max(0,TARGET_RECORD_COUNT-records.length),
 status:'PARTIAL_UNVALIDATED', note:'Do not invent missing anatomical structures or ROM angles.'});
export function jointById(id){return ANATOMICAL_JOINTS.find(j=>j.id===id)||null;}
export function jointAudit(){
 const ids=new Set(ANATOMICAL_JOINTS.map(j=>j.id));
 return { ...COVERAGE, uniqueIds:ids.size===ANATOMICAL_JOINTS.length,
  motorReady:ANATOMICAL_JOINTS.filter(j=>j.motorEnabled&&j.axes.every(a=>a.verified)).length,
  regions:[...new Set(ANATOMICAL_JOINTS.map(j=>j.region))]};
}
