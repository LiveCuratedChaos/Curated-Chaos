import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('live Chase preparation defaults to offline without every explicit startup guard',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'cc-chase-guard-')),tool=fileURLToPath(new URL('../tools/chase-authorization-server.mjs',import.meta.url));
 try{for(const args of [[],['--prepare-live-chase'],['--project=fngauurauwvbawlfzbbe']]){const output=execFileSync(process.execPath,[tool,...args],{cwd,encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials read, no network requests, no database writes/);}}finally{rmSync(cwd,{recursive:true,force:true});}
});
test('local Chase authorization has session-bound, same-origin controls and no transaction/import route',()=>{
 const script=readFileSync(new URL('../tools/chase-authorization-server.mjs',import.meta.url),'utf8');assert.match(script,/HttpOnly; SameSite=Lax/);assert.match(script,/req.headers.origin!==origin/);assert.match(script,/req.headers\['x-cc-csrf'\]!==csrf/);assert.match(script,/flag:'wx',mode:0o600/);assert.doesNotMatch(script,/transactionsGet|readGmailWindow|createDevProviderRepository|insertMany/);
});
