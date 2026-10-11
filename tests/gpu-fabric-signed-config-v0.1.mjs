// Ephemeral interoperability harness. Never stores private signing keys.
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {signStagePackage,stageSigningPublicKey} from '../aivault-collab-v0.2/gpu-fabric-signed-config-v0.1.mjs';
const binary=process.argv[2];if(!binary)throw new Error('compiled Swift verifier required');
const dir=mkdtempSync(join(tmpdir(),'fabric-signed-'));
try {
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
  const now=Date.now(), expiry=new Date(now+120000).toISOString();
  const payload={package_id:'a354719a-ec20-497e-874e-b13bd8dbf251',node_id:'node-b',job_id:'signed-model-job',
    issued_at:new Date(now).toISOString(),expires_at:expiry,
    operations:[{operation_id:'op-b',node_id:'node-b',input_tensor_id:'h',output_tensor_id:'y',dependency_id:null,
      layer:{input_size:4,output_size:2,weights:[1,2,-1,0.5,-1,0,1,2],bias:[0.25,-0.5],activation:'identity'}}],
    incoming_grant:{token:'ephemeral-signed-test-grant-0001',sender_node_id:'node-a',job_id:'signed-model-job',operation_id:'op-b',tensor_id:'h',shape:[4],expires_at:expiry},next:null};
  const pack=p=>signStagePackage(p,{keyId:'research-key-1',privateKey});
  const valid=pack(payload), tampered={...valid,payload_base64:Buffer.from(JSON.stringify({...payload,job_id:'attacker-job'})).toString('base64')};
  const fixtures={publicKey:stageSigningPublicKey(privateKey).toString('base64'),valid,
    tampered,wrongKey:signStagePackage(payload,{keyId:'research-key-1',privateKey:other}),
    wrongNode:pack({...payload,node_id:'node-c'}),
    expired:pack({...payload,issued_at:new Date(now-120000).toISOString(),expires_at:new Date(now-60000).toISOString()}),
    future:pack({...payload,issued_at:new Date(now+60000).toISOString()}),
    expiryMismatch:pack({...payload,expires_at:new Date(now+60000).toISOString()}),
    badGraph:pack({...payload,operations:[{...payload.operations[0],layer:{...payload.operations[0].layer,weights:[1]}}]}),
    badGrant:pack({...payload,incoming_grant:{...payload.incoming_grant,job_id:'wrong-job'}}),
    changedKeyID:{...valid,key_id:'research-key-2'}};
  const file=join(dir,'fixtures.json');writeFileSync(file,JSON.stringify(fixtures),{mode:0o600});
  execFileSync(binary,[file,dir],{stdio:'inherit',timeout:30000});
} finally {rmSync(dir,{recursive:true,force:true});}
