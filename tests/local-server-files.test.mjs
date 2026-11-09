import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {makeHandler} from '../tools/local-server.mjs';
async function call(handler,path){const response={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};await handler({url:path,method:'GET'},response);return response;}
test('local server rejects public file and directory links to private data',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cc-file-boundary-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'private'));await writeFile(join(root,'private','core.mjs'),'FICTIONAL_PRIVATE_CONTENT');await mkdir(join(root,'src'));await symlink(join(root,'private','core.mjs'),join(root,'src','core.mjs'));
 let result=await call(makeHandler(root),'/src/core.mjs');assert.equal(result.status,404);assert.doesNotMatch(String(result.body),/FICTIONAL_PRIVATE_CONTENT/);
 await rm(join(root,'src'),{recursive:true});await symlink(join(root,'private'),join(root,'src'));result=await call(makeHandler(root),'/src/core.mjs');assert.equal(result.status,404);
});
test('ordinary allowlisted modules serve but local credentials and recovery files never do',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cc-public-files-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'src'));await writeFile(join(root,'src','core.mjs'),'export const fictional=true;');const handler=makeHandler(root),result=await call(handler,'/src/core.mjs');assert.equal(result.status,200);assert.match(String(result.body),/fictional=true/);
 for(const path of ['/.env.local','/.local/provider-storage/encryption-key','/recovery.ccrecovery','/server/private-recovery.mjs','/tools/Create-Recovery.command'])assert.equal((await call(handler,path)).status,404);
});
