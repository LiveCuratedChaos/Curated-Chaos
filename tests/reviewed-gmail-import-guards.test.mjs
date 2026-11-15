import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateImportArguments} from '../tools/import-reviewed-gmail.mjs';
test('reviewed Gmail import requires explicit project, cap and bounded valid dates',()=>{
 assert.equal(validateImportArguments([]),null);
 const args=['--allow-real-gmail-import','--project=fngauurauwvbawlfzbbe','--max-items=9','--start=2026-11-01','--end=2026-11-08'];assert.equal(validateImportArguments(args).maxItems,9);
 for(const invalid of [args.filter(a=>!a.startsWith('--project=')),args.filter(a=>!a.startsWith('--max-items=')),args.map(a=>a.startsWith('--max-items=')?'--max-items=251':a),args.map(a=>a.startsWith('--end=')?'--end=2027-01-01':a),args.map(a=>a.startsWith('--start=')?'--start=2026-02-30':a)])assert.throws(()=>validateImportArguments(invalid));
});
test('reviewed Gmail default invocation reads no local credentials or network',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'cc-reviewed-gmail-'));try{const result=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/import-reviewed-gmail.mjs',import.meta.url))],{cwd,encoding:'utf8'});assert.match(result,/PLAN ONLY/);assert.match(result,/no credentials read, no network requests, no database writes/);}finally{rmSync(cwd,{recursive:true,force:true});}
});
