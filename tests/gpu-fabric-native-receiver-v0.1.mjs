// macOS CI harness only. Test TLS identity and anchor never leave this directory.
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
  const config = join(directory,'config.json');
  writeFileSync(config,JSON.stringify({directory,identityPath,certDERPath}),{mode:0o600});
  execFileSync(binary,[config],{stdio:'inherit',timeout:90000});
} finally { rmSync(directory,{recursive:true,force:true}); }
