import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir,symlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
async function directory(t){const path=await mkdtemp(join(tmpdir(),'cc-key-recovery-'));await chmod(path,0o700);t.after(()=>rm(path,{recursive:true,force:true}));return path;}
test('lost key never gets replaced when encrypted records remain; original key restores access',async t=>{
 const dir=await directory(t),first=await createLocalProviderStore(dir),key=await readFile(join(dir,'encryption-key'));
 const envelope=first.sealer.seal({fixture:true},'recovery-fixture');await writeFile(join(dir,'fixture.connection'),envelope,{mode:0o600});await rm(join(dir,'encryption-key'));
 await assert.rejects(createLocalProviderStore(dir),/Restore the original key/);assert.deepEqual(await readdir(dir),['fixture.connection']);assert.equal(await readFile(join(dir,'fixture.connection'),'utf8'),envelope);
 await writeFile(join(dir,'encryption-key'),key,{flag:'wx',mode:0o600});const restored=await createLocalProviderStore(dir);assert.deepEqual(restored.sealer.unseal(envelope,'recovery-fixture'),{fixture:true});
});
test('invalid or linked key is rejected without overwriting it',async t=>{
 const dir=await directory(t),path=join(dir,'encryption-key');await writeFile(path,'invalid',{mode:0o600});await assert.rejects(createLocalProviderStore(dir));assert.equal(await readFile(path,'utf8'),'invalid');
 await rm(path);const target=join(dir,'original');await writeFile(target,Buffer.alloc(32),{mode:0o600});await symlink(target,path);await assert.rejects(createLocalProviderStore(dir),/permissions/);assert.deepEqual(await readFile(target),Buffer.alloc(32));
});
