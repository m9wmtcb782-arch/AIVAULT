/**
 * Pure forward kinematics for a reference skeleton. Local transforms only.
 * No skin deformation, collisions, forces, or production actuation.
 */
const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
const mul=(a,b)=>[
 a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
 a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
 a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
 a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
];
const rotate=(q,v)=>{
 const p=mul(mul(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]);
 return p.slice(0,3);
};
const normalize=q=>{const n=Math.hypot(...q);if(n<1e-12)throw Error('ZERO_QUATERNION');return q.map(x=>x/n)};
export function forwardKinematics(skeleton,localOverrides={}){
 const nodes=skeleton?.nodes;
 if(!Array.isArray(nodes)||!nodes.length)throw Error('INVALID_SKELETON');
 const parent=Array(nodes.length).fill(-1);
 nodes.forEach((n,i)=>{for(const c of n.children||[]){
  if(!Number.isInteger(c)||c<0||c>=nodes.length||c===i||parent[c]!==-1)throw Error('INVALID_HIERARCHY');
  parent[c]=i;
 }});
 const cache=new Map(),visiting=new Set();
 function resolve(i){
  if(cache.has(i))return cache.get(i);
  if(visiting.has(i))throw Error('CYCLIC_SKELETON');
  visiting.add(i);
  const n=nodes[i],o=localOverrides[n.name]||{},t=o.translation??n.translation??[0,0,0],q=o.rotation??n.rotation??[0,0,0,1];
  if(!finite(t)||t.length!==3||!finite(q)||q.length!==4)throw Error('INVALID_TRANSFORM');
  const local=normalize(q),p=parent[i];
  const world=p<0?{position:[...t],rotation:local}:(()=>{
   const a=resolve(p),r=rotate(a.rotation,t);
   return {position:a.position.map((x,j)=>x+r[j]),rotation:normalize(mul(a.rotation,local))};
  })();
  visiting.delete(i);cache.set(i,world);return world;
 }
 return nodes.map((n,i)=>({name:n.name,index:i,...resolve(i)}));
}
export function axisAngleQuaternion(axis,degrees){
 if(!finite(axis)||axis.length!==3||!Number.isFinite(degrees))throw Error('INVALID_AXIS_ANGLE');
 const length=Math.hypot(...axis);if(length<1e-12)throw Error('ZERO_AXIS');
 const half=degrees*Math.PI/360,s=Math.sin(half)/length;
 return normalize([axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(half)]);
}
