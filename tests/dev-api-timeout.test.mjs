import test from 'node:test';import assert from 'node:assert/strict';import {createDevApi} from '../src/dev-api.mjs';
const config={supabaseUrl:'https://devproject123.supabase.co',projectRef:'devproject123',publishableKey:'sb_publishable_fixture'};
test('development request deadline aborts a stalled fetch with an uncertain-save warning',async()=>{
 const api=createDevApi(config,async(_url,options)=>new Promise((_yes,no)=>options.signal.addEventListener('abort',()=>no(Error('fixture aborted')))),{timeoutMs:5});await assert.rejects(api.listBriefRecords('fixture'),/timed out.*save may have reached/);
});
test('development deadline also covers a stalled response body',async()=>{
 const api=createDevApi(config,async(_url,options)=>({ok:true,text:()=>new Promise((_yes,no)=>options.signal.addEventListener('abort',()=>no(Error('fixture body aborted'))))}),{timeoutMs:5});await assert.rejects(api.listBriefRecords('fixture'),/timed out/);
});
test('successful calls clear their deadline without aborting a completed request',async()=>{
 let signal;const api=createDevApi(config,async(_url,options)=>{signal=options.signal;return{ok:true,text:async()=>'[]'};},{timeoutMs:5});assert.deepEqual(await api.listBriefRecords('fixture'),[]);await new Promise(yes=>setTimeout(yes,10));assert.equal(signal.aborted,false);assert.throws(()=>createDevApi(config,fetch,{timeoutMs:0}));
});
