// AIVAULT isolated 3D rigid-body solver, SI units. No production avatar actuation.
// Semi-implicit Euler, sphere-ground contact, Coulomb friction, and spring-damper distance constraints.
// Demonstration-grade, NOT validated human biomechanics.
const V=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const scale=(a,s)=>V(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.sqrt(dot(a,a));
const finiteVec=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
export function createWorld({gravity=9.81,dt=1/120,groundZ=0}={}){
 if(!Number.isFinite(gravity)||gravity<0||!Number.isFinite(dt)||dt<=0||dt>1/30||!Number.isFinite(groundZ))throw Error('INVALID_WORLD');
 const bodies=new Map(),links=[];
 function addBody({id,mass=1,radius=.1,position=V(),velocity=V(),restitution=0,friction=.7}){
  if(!id||bodies.has(id)||!(mass>0)||!(radius>0)||!finiteVec(position)||!finiteVec(velocity)||restitution<0||restitution>1||friction<0)throw Error('INVALID_BODY');
  bodies.set(id,{id,mass,radius,position:{...position},velocity:{...velocity},force:V(),restitution,friction});
 }
 function link({a,b,restLength,stiffness=100,damping=5}){
  if(!bodies.has(a)||!bodies.has(b)||a===b||!(restLength>0)||stiffness<0||damping<0)throw Error('INVALID_LINK');
  links.push({a,b,restLength,stiffness,damping});
 }
 function force(id,f){const b=bodies.get(id);if(!b||!finiteVec(f))throw Error('INVALID_FORCE');b.force=add(b.force,f)}
 function step(n=1){
  if(!Number.isInteger(n)||n<1||n>10000)throw Error('INVALID_STEPS');
  for(let tick=0;tick<n;tick++){
   for(const l of links){
    const a=bodies.get(l.a),b=bodies.get(l.b),delta=sub(b.position,a.position),length=norm(delta);
    if(length<1e-10)continue;
    const direction=scale(delta,1/length),relative=dot(sub(b.velocity,a.velocity),direction);
    const f=scale(direction,l.stiffness*(length-l.restLength)+l.damping*relative);
    a.force=add(a.force,f);b.force=sub(b.force,f);
   }
   for(const b of bodies.values()){
    b.velocity=add(b.velocity,scale(add(b.force,V(0,0,-gravity*b.mass)),dt/b.mass));
    b.position=add(b.position,scale(b.velocity,dt));
    const floor=groundZ+b.radius;
    if(b.position.z<floor){
     b.position.z=floor;
     if(b.velocity.z<0)b.velocity.z=-b.velocity.z*b.restitution;
     const frictionStep=Math.max(0,1-b.friction*gravity*dt/Math.max(1e-9,Math.hypot(b.velocity.x,b.velocity.y)));
     b.velocity.x*=frictionStep;b.velocity.y*=frictionStep;
    }
    b.force=V();
    if(!finiteVec(b.position)||!finiteVec(b.velocity))throw Error('NUMERICAL_DIVERGENCE');
   }
  }
  return snapshot();
 }
 function snapshot(){return [...bodies.values()].map(({id,mass,radius,position,velocity})=>({id,mass,radius,position:{...position},velocity:{...velocity}}))}
 return {addBody,link,force,step,snapshot,settings:{gravity,dt,groundZ},validatedForHumanActuation:false};
}
