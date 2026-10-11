// Offline checksums for a reviewed local installation lock. Does not download,
// install, license-approve, load or promote a model; no untrusted weight code runs.
import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { getOwnedModel } from './gpu-fabric-owned-models-v0.1.mjs';

export async function verifyOwnedModelWeights(root, lock) {
  lock=structuredClone(lock); // Pin reviewed metadata before awaits.
  const model=getOwnedModel(lock?.model_id);
  if (!model||lock.weight_bundle!==model.weight_bundle||! /^[a-f0-9]{40}$/.test(lock.revision??'')) throw Error('invalid model/source/revision lock');
  if (!Array.isArray(lock.files)||!lock.files.length||lock.files.length>10000) throw Error('invalid file inventory');
  const seen=new Set();
  for (const file of lock.files) {
    if (typeof file?.path!=='string'||file.path.length>500||file.path.split('/').some(x=>! /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(x))||seen.has(file.path)||
        !Number.isSafeInteger(file.size_bytes)||file.size_bytes<=0||! /^[a-f0-9]{64}$/.test(file.sha256??'')) throw Error('invalid file lock');
    seen.add(file.path);
  }
  const base=resolve(root);
  if (await realpath(base)!==base||(await lstat(base)).isSymbolicLink()) throw Error('symlinked root denied');
  for (const file of lock.files) {
    const parts=file.path.split('/');let path=base;
    // Reject symlink parents, then open the final component without following it.
    for (const part of parts) {path=join(path,part);if((await lstat(path)).isSymbolicLink())throw Error('symlinked weight denied');}
    const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
      const before=await handle.stat();
      if(!before.isFile()||before.size!==file.size_bytes)throw Error('weight size/type mismatch');
      const hash=createHash('sha256'),buffer=Buffer.alloc(1024*1024);let position=0;
      while(position<before.size){const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,before.size-position),position);if(!bytesRead)throw Error('weight truncated');hash.update(buffer.subarray(0,bytesRead));position+=bytesRead;}
      const after=await handle.stat();
      if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||hash.digest('hex')!==file.sha256)throw Error('weight integrity mismatch');
    } finally {await handle.close();}
  }
  return {status:'CHECKSUMS_VERIFIED',model_id:model.model_id,revision:lock.revision,
    verified_files:lock.files.length,model_loaded:false,fabric_ready:false,
    note:'Local bytes match the supplied lock only; manifest completeness, publisher authenticity and future reads need independent verification.'};
}
