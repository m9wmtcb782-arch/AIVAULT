import { sign, createPublicKey } from 'node:crypto';

// Research coordinator primitive. No key generation, network, enrollment or deploy.
// The JSON payload contains bearer grants: signatures do NOT encrypt it.
export function signStagePackage(payload, {keyId, privateKey}) {
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(keyId) || /\s/.test(keyId)) throw new Error('invalid signing key ID');
  const key=createPublicKey(privateKey);
  const jwk=key.export({format:'jwk'});
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('P-256 signing key required');
  const bytes=Buffer.from(JSON.stringify(payload));
  if (bytes.length > 4*1024*1024) throw new Error('config package too large');
  return {protocol_version:'aivault.gpu-fabric-stage-package/0.1',key_id:keyId,
    payload_base64:bytes.toString('base64'),signature_base64:sign('sha256',Buffer.concat([Buffer.from('aivault.gpu-fabric-stage-package/0.1\n'+keyId+'\n'),bytes]),privateKey).toString('base64')};
}
export function stageSigningPublicKey(privateKey) {
  const jwk=createPublicKey(privateKey).export({format:'jwk'});
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('P-256 signing key required');
  return Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]);
}

export function signMatrixStagePackage(payload, {keyId, privateKey}) {
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(keyId) || /\s/.test(keyId)) throw new Error('invalid signing key ID');
  const key=createPublicKey(privateKey);
  const jwk=key.export({format:'jwk'});
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('P-256 signing key required');
  const bytes=Buffer.from(JSON.stringify(payload));
  if (bytes.length > 4*1024*1024) throw new Error('config package too large');
  return {protocol_version:'aivault.gpu-fabric-matrix-stage-package/0.1',key_id:keyId,
    payload_base64:bytes.toString('base64'),signature_base64:sign('sha256',Buffer.concat([Buffer.from('aivault.gpu-fabric-matrix-stage-package/0.1\n'+keyId+'\n'),bytes]),privateKey).toString('base64')};
}
