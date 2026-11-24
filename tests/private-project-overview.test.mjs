// Fictional pure overview contract tests: no database/configuration/provider reads.
import test from 'node:test';import assert from 'node:assert/strict';
import {privateProjectOverview} from '../server/private-project-overview.mjs';
import {verifyPrivateProjectOverview} from '../src/private-project-overview.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z');
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0'),token=n=>String(n).padStart(43,'a');
const row=(n,status='Active',title='Fictional project '+n)=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Work',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:4,created_at:'2026-11-01T12:00:00.123456Z',deleted_at:null,payload:{fictional:true,schemaVersion:1,title,status}});
const build=(rows,patch={})=>privateProjectOverview({rows,ownerId:owner,projectAction:r=>({projectReadToken:token(Number(r.id.slice(-12)))}),now,expiresAt:now+600000,...patch});
const copy=value=>structuredClone(value);
test('current project overview counts complete inventory but only issues five sorted open-project handles',()=>{
 const rows=[row(7,'Completed'),row(5,'On hold','B'),row(1,'Planned','A'),row(4,'Active','D'),row(2,'Active','A'),row(6,'Completed'),row(3,'On hold','C'),row(8,'Active','E')],seen=[],before=copy(rows);
 rows[1].payload.description='PRIVATE_PROJECT_DETAILS';rows[1].payload.secret='PRIVATE_EXTRA';const withDetails=copy(rows);
 const result=build(rows,{projectAction:r=>{seen.push(r);assert.equal(r.payload.description,undefined);assert.equal(r.payload.secret,undefined);return{projectReadToken:token(Number(r.id.slice(-12)))};}});
 assert.equal(result.totalCount,8);assert.equal(result.openCount,6);assert.equal(result.completedCount,2);assert.equal(result.omittedOpenCount,1);assert.equal(result.checkedAt,new Date(now).toISOString());assert.equal(result.expiresAt,now+300000);assert.deepEqual(result.projects.map(p=>p.title),['A','A','B','C','D']);assert.deepEqual(seen.map(r=>r.id),[1,2,5,3,4].map(id));assert.equal(seen.length,5);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|owner_id|11111111|description|payload|task|due|progress/);assert.deepEqual(rows,withDetails);assert.equal(before.length,8);assert.equal(verifyPrivateProjectOverview(result,{now}),result);
});
test('empty and all-completed current snapshots are truthful and issue no handles',()=>{
 let issued=0;for(const rows of [[],[row(1,'Completed'),row(2,'Completed')]]){
  const value=build(rows,{projectAction:()=>{issued++;throw Error('No open project should be issued');}});assert.equal(value.totalCount,rows.length);assert.equal(value.openCount,0);assert.equal(value.completedCount,rows.length);assert.equal(value.omittedOpenCount,0);assert.deepEqual(value.projects,[]);
 }
 assert.equal(issued,0);const unavailable={available:false};assert.equal(verifyPrivateProjectOverview(unavailable,{now}),unavailable);
 for(const extra of [{totalCount:1},{projects:[]},{error:'PRIVATE_ERROR'}])assert.throws(()=>verifyPrivateProjectOverview({...unavailable,...extra},{now}));
});
test('overview refuses incomplete source, duplicate identities, excessive counts and wrong private scope',()=>{
 for(const rows of [null,undefined,{},[null],[row(1),row(1)],Array.from({length:2001},(_,n)=>row(n+1))])assert.throws(()=>build(rows));
 const base=row(1);for(const patch of [{owner_id:other},{household_id:other},{visibility:'household'},{origin:'OTHER'},{deleted_at:new Date(now).toISOString()},{section:'Finances'},{version:0},{created_at:'invalid'},{payload:{...base.payload,fictional:false}},{payload:{...base.payload,schemaVersion:2}},{payload:{...base.payload,status:'Unknown'}},{payload:{...base.payload,title:' noncanonical '}},{payload:{...base.payload,title:'x'.repeat(141)}}])assert.throws(()=>build([{...base,...patch}]));
 assert.throws(()=>build([],{ownerId:'invalid'}));assert.throws(()=>build([],{projectAction:null}));
 assert.equal(build(Array.from({length:2000},(_,n)=>row(n+1,'Completed'))).totalCount,2000);
});
test('only exact opaque read handles can enter the overview; callback data cannot leak',()=>{
 for(const action of [null,{},[],{projectReadToken:'bad'},{projectReadToken:2},{projectReadToken:token(1),description:'PRIVATE'},{projectReadToken:token(1),editToken:token(2)}])assert.throws(()=>build([row(1)],{projectAction:()=>action}));
 assert.throws(()=>build([row(1),row(2)],{projectAction:()=>({projectReadToken:token(1)})}));
});
test('server expiry is explicit, future and capped at five minutes',()=>{
 for(const expiresAt of [undefined,null,NaN,Infinity,now,now-1,'future'])assert.throws(()=>build([],{expiresAt}));
 assert.equal(build([],{expiresAt:now+1}).expiresAt,now+1);assert.equal(build([],{expiresAt:now+900000}).expiresAt,now+300000);
 for(const invalidNow of [NaN,Infinity,'now'])assert.throws(()=>build([],{now:invalidNow}));
});
test('client refuses future/stale checked times or expired/extended views',()=>{
 const value=build([row(1)]);
 for(const patch of [{checkedAt:new Date(now+1).toISOString()},{checkedAt:new Date(now-300001).toISOString()},{checkedAt:'2026-02-30T12:00:00Z'},{checkedAt:'invalid'},{expiresAt:now},{expiresAt:now+300001},{expiresAt:Infinity},{expiresAt:'future'}])assert.throws(()=>verifyPrivateProjectOverview({...value,...patch},{now}));
 const almostExpired={...value,checkedAt:new Date(now-299999).toISOString(),expiresAt:now+1};assert.equal(verifyPrivateProjectOverview(almostExpired,{now}),almostExpired);assert.throws(()=>verifyPrivateProjectOverview(value,{now:NaN}));
});
test('client count consistency, display limits and exact schemas fail closed',()=>{
 const value=build([row(1),row(2),row(3,'Completed')]);
 for(const patch of [{totalCount:4},{openCount:3},{completedCount:-1},{openCount:1.5},{totalCount:2001},{omittedOpenCount:1},{projects:[]},{projects:[value.projects[0],value.projects[0]]},{available:'true'},{privateBody:'secret'},{day:'2026-11-01'},{progress:50}])assert.throws(()=>verifyPrivateProjectOverview({...value,...patch},{now}));
 for(const patch of [{type:'task'},{title:' invalid '},{title:'x'.repeat(141)},{section:'Calendar'},{projectStatus:'Completed'},{projectStatus:'Unknown'},{projectReadToken:'invalid'},{id:id(1)},{description:'PRIVATE'},{due:'2026-11-18'}])assert.throws(()=>verifyPrivateProjectOverview({...value,projects:[{...value.projects[0],...patch},value.projects[1]]},{now}));
 for(const bad of [null,undefined,[],{},true])assert.throws(()=>verifyPrivateProjectOverview(bad,{now}));
});

test('widget-enabled overview derives exact area counts before caps and reuses at most forty original capabilities',()=>{
 const areas=['Home','Personal Life','Work','School'],rows=Array.from({length:64},(_,i)=>({...row(i+1,i%16===15?'Completed':'Active','Fictional '+String(i).padStart(3,'0')),section:areas[Math.floor(i/16)]}));let issued=0;const value=build(rows,{includeWidgets:true,projectAction:r=>{issued++;return{projectReadToken:token(Number(r.id.slice(-12)))}}});assert.equal(value.openCount,60);assert.equal(value.completedCount,4);assert.equal(issued,40);assert.equal(value.widgetProjects.areas.all.rows.length,10);for(const area of areas){assert.equal(value.widgetProjects.areas[area].openCount,15);assert.equal(value.widgetProjects.areas[area].completedCount,1);assert.equal(value.widgetProjects.areas[area].rows.length,10);assert.ok(value.widgetProjects.areas[area].rows.every(r=>r.section===area));}assert.deepEqual(value.projects,value.widgetProjects.areas.all.rows.slice(0,5));assert.doesNotMatch(JSON.stringify(value),/description|owner_id|"id"|fictional.*body/);assert.equal(Object.hasOwn(build(rows),'widgetProjects'),false);
 for(const alter of [v=>{v.widgetProjects.schemaVersion=2},v=>{v.widgetProjects.areas.Work.openCount=0},v=>{v.widgetProjects.areas.Home.rows[0].section='Work'},v=>{v.widgetProjects.areas.Work.rows=[]},v=>{v.widgetProjects.areas.all.rows[0].description='private'},v=>{v.widgetProjects.areas.extra={}},v=>{v.widgetProjects.areas.Home.rows[0].projectReadToken=v.widgetProjects.areas.Work.rows[0].projectReadToken}]){const invalid=copy(value);alter(invalid);assert.throws(()=>verifyPrivateProjectOverview(invalid,{now}));}
});
test('Home project widget exposes only a bounded asset label, latest usage and warranty summary',()=>{const asset={kind:'vehicle',make:'Honda',model:'CR-V',year:'2024',usageUnit:'miles',usageEntries:[{day:'2026-10-01',value:4120,note:'oil receipt secret'}],warrantyEndDay:'2029-10-01',receiptNote:'private invoice reference'};const home={...row(9,'Active','Vehicle care'),section:'Home',payload:{...row(9).payload,homeAsset:asset}},result=build([home],{includeWidgets:true}),summary=result.widgetProjects.areas.Home.rows[0].homeAssetSummary;assert.deepEqual(summary,{kind:'vehicle',label:'2024 Honda CR-V',usageUnit:'miles',latestUsageDay:'2026-10-01',latestUsageValue:4120,warrantyEndDay:'2029-10-01'});assert.doesNotMatch(JSON.stringify(result),/receipt secret|private invoice reference/);assert.equal(verifyPrivateProjectOverview(result,{now}),result);});
