import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const tool=fileURLToPath(new URL('../tools/verify-provider-import.mjs',import.meta.url));
test('import verification remains offline without every explicit write guard',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'cc-import-guard-'));
 try{for(const args of [[],['--allow-dev-writes'],['--allow-dev-writes','--fixtures-only'],['--fixtures-only','--project=fixture']]){
  const output=execFileSync(process.execPath,[tool,...args],{cwd,encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials read, no network requests, no database writes/);
 }}finally{rmSync(cwd,{recursive:true,force:true});}
});
