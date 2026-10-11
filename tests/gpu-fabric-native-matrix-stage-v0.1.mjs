import {generateKeyPairSync} from 'node:crypto';
import {signMatrixStagePackage,signStagePackage,stageSigningPublicKey} from '../aivault-collab-v0.2/gpu-fabric-signed-config-v0.1.mjs';
// Matrix graph CI harness only. Test TLS identity and anchor never leave this directory.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const binary = process.argv[2];
if (!binary) throw new Error('compiled native receiver test is required');
const directory = mkdtempSync(join(tmpdir(), 'aivault-native-receive-'));
try {
  const key = join(directory,'key.pem'), cert = join(directory,'cert.pem');
  const certDERPath = join(directory,'cert.der'), identityPath = join(directory,'identity.p12');
  const opensslConfig = join(directory,'openssl.cnf');
  writeFileSync(opensslConfig,'[req]\ndistinguished_name=dn\n[dn]\n[v3_req]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,
    '-days','1','-subj','/CN=localhost','-config',opensslConfig,'-extensions','v3_req'],{stdio:'ignore'});
  execFileSync('openssl',['x509','-in',cert,'-outform','DER','-out',certDERPath],{stdio:'ignore'});
  // Explicit legacy P12 wrapping is only for CI compatibility; TLS stays 1.2+.
  execFileSync('openssl',['pkcs12','-export','-inkey',key,'-in',cert,'-out',identityPath,
    '-passout','pass:ephemeral-ci-only','-certpbe','PBE-SHA1-3DES','-keypbe','PBE-SHA1-3DES','-macalg','sha1'],{stdio:'ignore'});
  const privateKey=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
  const otherKey=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
  const expiry=new Date(Date.now()+120000).toISOString();
  const operations=[
    {operation_id:'op-a',node_id:'node-a',input_tensor_id:'x',output_tensor_id:'h',dependency_id:null,layer:{kind:'scores',rows:2,inner:2,columns:2,weights:[1,0,0,1]}},
    {operation_id:'op-b',node_id:'node-b',input_tensor_id:'h',output_tensor_id:'y',dependency_id:'op-a',layer:{kind:'apply',rows:2,inner:2,columns:2,weights:[2,4,6,8]}}];
  const payload={package_id:'357615f0-f76f-4b9b-aa76-f95b0b8ec6dc',node_id:'node-b',job_id:'matrix-signed-fixture',
    issued_at:new Date(Date.now()-1000).toISOString(),expires_at:expiry,operations,next:null,
    incoming_grant:{token:'ephemeral-matrix-fixture-token',sender_node_id:'node-a',job_id:'matrix-signed-fixture',operation_id:'op-b',tensor_id:'h',shape:[4],expires_at:expiry}};
  const sign=p=>signMatrixStagePackage(p,{keyId:'matrix-test-key',privateKey});
  const valid=sign(payload),fixtures={publicKey:stageSigningPublicKey(privateKey).toString('base64'),valid,
    tampered:{...valid,payload_base64:Buffer.from(JSON.stringify({...payload,job_id:'attacker'})).toString('base64')},
    badKind:sign({...payload,operations:[operations[0],{...operations[1],layer:{...operations[1].layer,kind:'whole_model'}}]}),
    badWeights:sign({...payload,operations:[operations[0],{...operations[1],layer:{...operations[1].layer,weights:[]}}]}),
    badMatrixShape:sign({...payload,operations:[operations[0],{...operations[1],layer:{kind:'apply',rows:1,inner:4,columns:2,weights:Array(8).fill(1)}}]}),
    badShape:sign({...payload,incoming_grant:{...payload.incoming_grant,shape:[3]}}),
    expiryMismatch:sign({...payload,expires_at:new Date(Date.now()+60000).toISOString()}),
    wrongNode:sign({...payload,node_id:'node-c'}),
    wrongKey:signMatrixStagePackage(payload,{keyId:'matrix-test-key',privateKey:otherKey}),
    wrongDomain:signStagePackage(payload,{keyId:'matrix-test-key',privateKey})};
  const signedFixturesPath=join(directory,'signed-matrix-fixtures.json');
  writeFileSync(signedFixturesPath,JSON.stringify(fixtures),{mode:0o600});
  const config = join(directory,'config.json');
  writeFileSync(config,JSON.stringify({directory,identityPath,certDERPath,signedFixturesPath}),{mode:0o600});
  execFileSync(binary,[config],{stdio:'inherit',timeout:90000});
} finally { rmSync(directory,{recursive:true,force:true}); }
