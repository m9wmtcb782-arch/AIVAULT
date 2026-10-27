/* Dark Star balance recovery planner v0.1
 * Standalone physics-informed planner, NOT a rigid-body simulator.
 * Coordinates: meters, seconds; z up; horizontal x/y.
 * No avatar/DOM side effects.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vec=(v,k)=>{if(!v||!['x','y','z'].every(a=>finite(v[a])))throw Error('INVALID_'+k);return v};
const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
function hull(points){
 const p=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
 const lower=[],upper=[];
 for(const q of p){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],q)<=0)lower.pop();lower.push(q)}
 for(const q of p.slice().reverse()){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],q)<=0)upper.pop();upper.push(q)}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function inside(poly,p){
 if(poly.length<3)return false;
 return poly.every((a,i)=>cross(a,poly[(i+1)%poly.length],p)>=-1e-9);
}
export function centerOfMass(segments){
 if(!Array.isArray(segments)||!segments.length)throw Error('MISSING_SEGMENTS');
 let mass=0,x=0,y=0,z=0;
 for(const s of segments){
  if(!finite(s.massKg)||s.massKg<=0)throw Error('INVALID_MASS');
  const p=vec(s.position,'POSITION');mass+=s.massKg;
  x+=p.x*s.massKg;y+=p.y*s.massKg;z+=p.z*s.massKg;
 }
 return {massKg:mass,position:{x:x/mass,y:y/mass,z:z/mass}};
}
export function assessBalance({segments,velocity,contacts,gravity=9.80665}){
 const com=centerOfMass(segments),v=vec(velocity,'VELOCITY');
 if(!finite(gravity)||gravity<=0)throw Error('INVALID_GRAVITY');
 if(!Array.isArray(contacts))throw Error('INVALID_CONTACTS');
 const points=contacts.filter(c=>c.active===true).map(c=>({x:c.x,y:c.y}));
 if(points.some(p=>!finite(p.x)||!finite(p.y)))throw Error('INVALID_CONTACT_POINT');
 const polygon=hull(points);
 const omega=Math.sqrt(gravity/Math.max(com.position.z,0.01));
 const xcom={x:com.position.x+v.x/omega,y:com.position.y+v.y/omega};
 const supported=inside(polygon,{x:com.position.x,y:com.position.y});
 const captureInside=inside(polygon,xcom);
 const strategy=polygon.length<3?'NO_VALID_SUPPORT':!supported?'RECOVERY_STEP_REQUIRED':!captureInside?'ANKLE_HIP_OR_STEP':'MAINTAIN_BALANCE';
 return {com,omega,xcom,supportPolygon:polygon,supported,captureInside,strategy,
  requiresDynamicsSolver:true,actuationAllowed:false,
  status:'PHYSICS_INFORMED_ESTIMATE_ONLY'};
}
