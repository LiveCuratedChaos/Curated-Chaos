import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {LIFE_EXAMPLES,LIFE_SOURCES,makeFictionalLife,normalizeFictionalLife,lifeSummary,lifeSuggestions,isLifeFixtureSuggestion} from '../src/dev-life-model.mjs';
import {makeSuggestionDismissal,normalizedDismissals,isDuplicateTask,validateSuggestedTask} from '../src/dev-intelligence-model.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {allowedPublicPath,makeHandler} from '../tools/local-server.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
const owner='bb8f4c56-a302-48d3-8c40-dc2838a97221',other='aa8f4c56-a302-48d3-8c40-dc2838a97222';
const ids=['1f3ab922-5969-421d-9741-ad4fcab22359','2f3ab922-5969-421d-9741-ad4fcab22359','3f3ab922-5969-421d-9741-ad4fcab22359','4f3ab922-5969-421d-9741-ad4fcab22359','5f3ab922-5969-421d-9741-ad4fcab22359'];
const raw=(type,index=0,day='2026-10-31')=>({id:ids[index],...makeFictionalLife(type,owner,day),created_at:'2026-10-31T12:00:00Z'});
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('five fixed examples cover school finance and household without real provider access',()=>{
 assert.equal(LIFE_EXAMPLES.length,5);assert.deepEqual([...LIFE_SOURCES],['school','finances','household']);
 assert.deepEqual([...new Set(LIFE_EXAMPLES.map(x=>x.source))],[...LIFE_SOURCES]);
 for(const row of LIFE_EXAMPLES){assert.equal(row.title.startsWith('Sample '),true);assert.equal(row.detail.includes('Fictional'),true);}
 const bill=makeFictionalLife('utility-bill',owner,'2026-10-31');
 assert.equal(bill.section,'Finances');assert.equal(bill.item_type,'bill_fixture');assert.equal(bill.payload.amount,86.4);assert.equal(bill.payload.day,'2026-11-03');
 assert.equal(bill.visibility,'private');assert.equal(bill.household_id,null);assert.equal(bill.owner_id,owner);
 assert.throws(()=>makeFictionalLife('unknown',owner));assert.throws(()=>makeFictionalLife('utility-bill','invalid'));assert.throws(()=>makeFictionalLife('utility-bill',owner,'2026-02-30'));
});
test('only valid privately owned, unchanged prewritten records survive normalization',()=>{
 const a=raw('utility-bill');assert.equal(normalizeFictionalLife([a],owner).length,1);
 assert.equal(normalizeFictionalLife([a],other).length,0);
 for(const altered of [{...a,owner_id:other},{...a,visibility:'household'},{...a,household_id:ids[1]},{...a,origin:'external-import'},{...a,payload:{...a.payload,amount:9999}},{...a,payload:{...a.payload,day:'2026-10-31'}},{...a,payload:{...a.payload,source:'real-bank'}}]) assert.equal(normalizeFictionalLife([altered],owner).length,0);
});
test('same fixture inserted twice renders once; other template remains distinct',()=>{
 const a=raw('course-assessment'),dup={...a,id:ids[3],created_at:'2026-10-31T13:00:00Z'},b=raw('study-session',1);
 const list=normalizeFictionalLife([dup,a,b],owner);assert.equal(list.length,2);assert.equal(list[0].id,ids[0]);
});
test('summary uses saved rows only, correct category, seven-day window and overdue',()=>{
 const rows=normalizeFictionalLife([raw('course-assessment'),raw('study-session',1),raw('utility-bill',2),raw('kitchen-reset',3),raw('maintenance',4)],owner);
 assert.equal(lifeSummary(rows,'school','2026-10-31').length,2);
 assert.equal(lifeSummary(rows,'finances','2026-10-31').length,1);
 assert.equal(lifeSummary(rows,'household','2026-10-31').length,2);
 assert.equal(lifeSummary(rows,'school','2026-10-01').length,0);
 assert.equal(lifeSummary(rows,'school','2026-11-10').length,2); // overdue still visible
 assert.throws(()=>lifeSummary(rows,'unknown'));
 assert.throws(()=>lifeSummary(rows,'school','2026-10-31',365));
});
test('school and household sample suggestions are linked to saved rows; finance is display-only',()=>{
 const rows=normalizeFictionalLife([raw('course-assessment'),raw('study-session',1),raw('utility-bill',2),raw('kitchen-reset',3),raw('maintenance',4)],owner);
 const suggestions=lifeSuggestions(rows);
 assert.equal(suggestions.length,2);assert.ok(suggestions.every(isLifeFixtureSuggestion));
 assert.deepEqual(suggestions.map(x=>x.source),['school','household']);
 for(const suggestion of suggestions){
   assert.equal(suggestion.sourceId,suggestion.recordId);
   assert.match(suggestion.uncertainty,/Confirm/);
   assert.equal(validateSuggestedTask(suggestion,{title:suggestion.title,section:suggestion.section,day:suggestion.day}).day,suggestion.day);
   const decision=makeSuggestionDismissal(suggestion,owner);
   assert.equal(normalizedDismissals([decision],owner,[suggestion.id]).has(suggestion.id),true);
   assert.equal(normalizedDismissals([decision],other,[suggestion.id]).has(suggestion.id),false);
   assert.equal(isDuplicateTask([{item_type:'task',payload:{fictional:true,title:'edited title',day:'2026-11-01',source:'M1A_APPROVED_'+suggestion.id}}],suggestion),true);
 }
 assert.equal(lifeSuggestions(rows.filter(x=>x.payload.template_id==='utility-bill')).length,0);
});
test('new routes and API are explicitly allowlisted without exposing .env or test assets',async()=>{
 for(const path of ['/dev-life.html','/src/dev-life.mjs','/src/dev-life-model.mjs'])assert.equal(allowedPublicPath(path),true);
 for(const path of ['/.env.local','/README.md','/tests/dev-life.test.mjs'])assert.equal(allowedPublicPath(path),false);
 assert.match(renderConnectedShell('life test',{active:'life'}),/LIFE SOURCES · QA ONLY/);
 assert.match(read('dev-life.html'),/data-theme="neutral"/);
 assert.match(read('src/dev-brief.mjs'),/listFictionalLife/);
 assert.match(read('src/dev-brief.mjs'),/lifeSummary\(life,source,today\)/);
 assert.match(read('src/dev-life.mjs'),/addFictionalLife/);
 assert.doesNotMatch(read('src/dev-life.mjs'),/localStorage|accounts\.google\.com|api\.gmail\.com|bank\.com/);
 const seen=[];
 const api=createDevApi({supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',projectRef:'abcdefghijklmnopqrst',publishableKey:'sb_publishable_abc123'},async(url,options)=>{seen.push({url,options});return {ok:true,text:async()=>JSON.stringify([])};});
 await api.listFictionalLife('test-jwt');await api.addFictionalLife('test-jwt',raw('utility-bill'));
 assert.ok(seen[0].url.includes('school_fixture,bill_fixture,household_fixture'));
 assert.equal(seen[0].options.headers.Authorization,'Bearer test-jwt');
 assert.equal(seen[1].options.method,'POST');
});
test('removed life source cannot generate suggestions or suppress its active replacement',()=>{
 const removed={id:ids[0],...makeFictionalLife('course-assessment',owner,'2026-11-08'),deleted_at:'2026-11-08T12:00:00Z'},replacement={...removed,id:ids[1],deleted_at:null};assert.deepEqual(normalizeFictionalLife([removed,replacement],owner),[replacement]);assert.deepEqual(lifeSuggestions([removed]),[]);
});
test('sample source API reads explicitly exclude removed and household records and include source revisions',async()=>{
 const queries=[],api=createDevApi({supabaseUrl:'https://devproject123.supabase.co',projectRef:'devproject123',publishableKey:'sb_publishable_fixture'},async url=>{queries.push(new URL(url).searchParams);return{ok:true,status:200,text:async()=>'[]'};});await api.listFictionalEmails('fixture');await api.listFictionalLife('fixture');for(const query of queries){assert.equal(query.get('deleted_at'),'is.null');assert.equal(query.get('household_id'),'is.null');assert.ok(query.get('select').split(',').includes('version'));assert.ok(query.get('select').split(',').includes('deleted_at'));}
});
