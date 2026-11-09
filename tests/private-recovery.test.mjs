import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,symlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {collectRecoveryFiles,sealRecoveryKit,openRecoveryKit,writeRecoveryKit} from '../server/private-recovery.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
const password='fictional recovery password only';
async function fixture(t){const parent=await mkdtemp(join(tmpdir(),'cc-recovery-'));await chmod(parent,0o700);t.after(()=>rm(parent,{recursive:true,force:true}));const root=join(parent,'project');await mkdir(join(root,'.local','provider-storage'),{recursive:true,mode:0o700});const key=randomBytes(32);await writeFile(join(root,'.local','provider-storage','encryption-key'),key,{mode:0o600});await writeFile(join(root,'.env.local'),'FICTIONAL_SECRET=local-only',{mode:0o600});return{parent,root,key};}
test('recovery copy encrypts original key and credentials; verified key decrypts existing fictional grant',async t=>{
 const f=await fixture(t),grant=createTokenSealer(f.key).seal({refreshToken:'fictional grant'},'fixture');await writeFile(join(f.root,'.local','provider-storage','fixture.connection'),grant,{mode:0o600});
 const output=join(f.parent,'recovery.ccrecovery'),result=await writeRecoveryKit(f.root,output,password);assert.equal(result.verified,true);assert.equal(result.databaseBackup,false);assert.equal((await lstat(output)).mode&0o077,0);
 const bytes=await readFile(output,'utf8');assert.doesNotMatch(bytes,/FICTIONAL_SECRET|refreshToken|encryption-key/);const recovered=await openRecoveryKit(bytes,password),key=Buffer.from(recovered.entries.find(e=>e.path.endsWith('encryption-key')).data,'base64');assert.deepEqual(createTokenSealer(key).unseal(grant,'fixture'),{refreshToken:'fictional grant'});assert.deepEqual(await readFile(join(f.root,'.local','provider-storage','encryption-key')),f.key);
 await assert.rejects(writeRecoveryKit(f.root,output,password),/EEXIST/);assert.equal(await readFile(output,'utf8'),bytes);
});
test('wrong password, tampered copy, short passwords and unsafe kit paths are rejected',async t=>{
 const f=await fixture(t),kit=await collectRecoveryFiles(f.root),sealed=await sealRecoveryKit(kit,password);
 await assert.rejects(openRecoveryKit(sealed,'wrong fictional password'),/could not be verified/);const tampered=JSON.parse(sealed);tampered.tag=Buffer.alloc(16).toString('base64');await assert.rejects(openRecoveryKit(JSON.stringify(tampered),password),/could not be verified/);await assert.rejects(sealRecoveryKit(kit,'short'),/16 characters/);await assert.rejects(sealRecoveryKit({...kit,entries:[...kit.entries,{path:'../escape',data:''}]},password));
});
test('recovery refuses linked or nonprivate sources, missing keys and output inside project',async t=>{
 const f=await fixture(t);await assert.rejects(writeRecoveryKit(f.root,join(f.root,'backup.ccrecovery'),password),/outside/);
 const keyPath=join(f.root,'.local','provider-storage','encryption-key');await chmod(keyPath,0o644);await assert.rejects(collectRecoveryFiles(f.root),/private/);await chmod(keyPath,0o600);await rm(keyPath);await assert.rejects(collectRecoveryFiles(f.root),/Original encryption key/);
 await symlink(join(f.root,'.env.local'),keyPath);await assert.rejects(collectRecoveryFiles(f.root),/without links/);
});
test('recovery CLI defaults offline and rejects noninteractive password entry',()=>{
 const {status,stdout}=spawnSync(process.execPath,[fileURLToPath(new URL('../tools/private-recovery.mjs',import.meta.url))],{encoding:'utf8'});assert.equal(status,0);assert.match(stdout,/PLAN ONLY/);assert.match(stdout,/No credentials read/);
 const denied=spawnSync(process.execPath,[fileURLToPath(new URL('../tools/private-recovery.mjs',import.meta.url)),'--create'],{encoding:'utf8',input:'fictional password must not be accepted from a pipe\n'});assert.equal(denied.status,1);assert.doesNotMatch(denied.stdout+denied.stderr,/fictional password must not/);
});
