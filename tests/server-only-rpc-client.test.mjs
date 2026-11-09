import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerOnlyRpcClient} from '../server/server-only-rpc-client.mjs';
const ref='syntheticproject1234';
const config={supabaseOrigin:'https://'+ref+'.supabase.co',expectedProjectRef:ref,serviceRoleKey:'synthetic-server-key'};
const response=()=>new Response('{"accepted":true}',{headers:{'content-type':'application/json'}});
const safe=error=>error.message==='Server operation unavailable.';
test('explicit synthetic transport targets only named project RPC with server-only headers',async()=>{
 let calls=0;const client=createServerOnlyRpcClient({...config,fetchImpl:async(url,options)=>{calls++;assert.equal(url,config.supabaseOrigin+'/rest/v1/rpc/cc_durable_session');assert.equal(options.method,'POST');assert.deepEqual(options.headers,{'Content-Type':'application/json',Authorization:'Bearer '+config.serviceRoleKey,apikey:config.serviceRoleKey});assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.body,'{"action":"create"}');assert.ok(options.signal instanceof AbortSignal);return response();}});
 assert.deepEqual(await client.rpc('cc_durable_session',{action:'create'}),{accepted:true});assert.equal(calls,1);
});
test('rejects non-exact origins, wrong project and invalid explicit configuration before fetch',()=>{
 let calls=0;const fetchImpl=()=>{calls++;};
 for(const supabaseOrigin of ['http://'+ref+'.supabase.co',config.supabaseOrigin+'/path',config.supabaseOrigin+'/?key=x',config.supabaseOrigin+'/#x','https://user:pass@'+ref+'.supabase.co',config.supabaseOrigin+':443','https://otherproject123.supabase.co',config.supabaseOrigin+'/../'])assert.throws(()=>createServerOnlyRpcClient({...config,supabaseOrigin,fetchImpl}),safe);
 for(const extra of [{expectedProjectRef:'wrong'},{serviceRoleKey:''},{serviceRoleKey:'key\nvalue'},{fetchImpl:null},{timeoutMs:0},{timeoutMs:Infinity}])assert.throws(()=>createServerOnlyRpcClient({...config,fetchImpl,...extra}),safe);
 assert.equal(calls,0);
});
test('unknown operations and oversized/invalid JSON never reach transport',async()=>{
 let calls=0;const client=createServerOnlyRpcClient({...config,fetchImpl:async()=>{calls++;return response();}});
 await assert.rejects(client.rpc('../other',{}),safe);
 for(const parameters of [null,[],{x:'x'.repeat(65536)},{x:undefined},{x:Infinity},{x:1n}])await assert.rejects(client.rpc('cc_durable_session',parameters),safe);
 const cycle={};cycle.self=cycle;await assert.rejects(client.rpc('cc_durable_session',cycle),safe);assert.equal(calls,0);
});
test('stateful failures are generic and never retried or expose upstream contents',async()=>{
 for(const fetchImpl of [async()=>{throw Error('private-upstream-marker');},async()=>new Response('private-upstream-marker',{status:500}),async()=>new Response('private-upstream-marker',{headers:{'content-type':'application/json'}}),async()=>new Response('{}',{headers:{'content-type':'text/html'}}),async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'999999'}}),async()=>new Response(JSON.stringify('x'.repeat(65536)),{headers:{'content-type':'application/json'}})]){
  let calls=0;const client=createServerOnlyRpcClient({...config,fetchImpl:async(...args)=>{calls++;return fetchImpl(...args);}});await assert.rejects(client.rpc('cc_durable_sync_job',{}),safe);assert.equal(calls,1);
 }
});
test('deadline aborts even when injected fetch ignores signal',async()=>{
 let signal;let calls=0;const client=createServerOnlyRpcClient({...config,timeoutMs:5,fetchImpl:(_url,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}});
 await assert.rejects(client.rpc('cc_durable_session',{}),safe);assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('deadline includes response body and malformed UTF8 fails safely',async()=>{
 let signal;const client=createServerOnlyRpcClient({...config,timeoutMs:5,fetchImpl:async(_url,options)=>{signal=options.signal;return new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}});}});
 await assert.rejects(client.rpc('cc_durable_session',{}),safe);assert.equal(signal.aborted,true);
 const invalid=createServerOnlyRpcClient({...config,fetchImpl:async()=>new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}})});await assert.rejects(invalid.rpc('cc_durable_session',{}),safe);
});
