import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarProjectTargets} from '../server/private-calendar-project-targets.mjs';
import {privateWorkspaceSearch} from '../server/private-workspace-search.mjs';
import {calendarWorkspaceFields,verifyCalendarWorkspaceList,calendarMonthOverview} from '../src/private-calendar-workspace.mjs';
import {makePrivateSessionPreview} from '../tools/private-session-preview-server.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=Date.parse('2026-11-16T17:00:00Z'),id=n=>'77777777-7777-4777-8777-'+String(n).padStart(12,'0'),stamp=new Date(now).toISOString(),fields=calendarWorkspaceFields({now});
const project=(n,extra={})=>({id:id(n),owner_id:owner,visibility:'private',household_id:null,section:'Work',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:1,created_at:stamp,updated_at:stamp,deleted_at:null,payload:{fictional:true,schemaVersion:1,title:'Fictional target '+n,description:'PRIVATE_DESCRIPTION_NEVER_RETURN',status:'Active',day:'2026-11-16',...extra}});
const event={id:id(999),owner_id:owner,visibility:'private',household_id:null,section:'Calendar',item_type:'event',version:1,created_at:stamp,deleted_at:null,payload:{fictional:true,title:'Fictional saved event',day:'2026-11-16',time:'12:00'}};
const search=(projects,values=fields,options={})=>({...privateWorkspaceSearch({rows:[event],projectRows:projects,ownerId:owner,values,now,eventOrderByTime:true,includeDates:true,...options}),expiresAt:now+300000});
test('project target projection is date-only, read-only and excludes archived/undated work without writes',()=>{
 const rows=[project(1),project(2,{archived:true}),project(3,{day:''}),project(4,{day:undefined})];delete rows[3].payload.day;const before=structuredClone(rows),seen=[];
 const result=search(rows,fields,{eventAction:r=>{seen.push(r.id);return{eventEditToken:'e'.repeat(43)};},recordAction:r=>({recordToken:'r'.repeat(43)})});
 verifyCalendarWorkspaceList(result,fields,{now});assert.equal(result.matchCount,2);assert.equal(result.results[0].projectTarget,true);assert.equal(result.results[0].projectArea,'Work');assert.equal(result.results[0].allDay,true);assert.equal(result.results[0].eventEditToken,undefined);assert.equal(result.results[0].recordToken,undefined);assert.deepEqual(seen,[event.id]);assert.deepEqual(rows,before);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_DESCRIPTION|owner_id|77777777|payload/);
 assert.equal(calendarMonthOverview(result,{now}).days[15].eventCount,2);
});
test('project source scope, identities and dates are verified even for hidden rows',()=>{
 for(const patch of [{owner_id:id(300)},{visibility:'household'},{household_id:id(300)},{deleted_at:stamp},{origin:'unexpected'},{version:0},{created_at:'bad'},{payload:{...project(1).payload,day:'2026-02-30'}},{payload:{...project(1).payload,archived:'true'}},{payload:{...project(1).payload,fictional:false}}])assert.throws(()=>calendarProjectTargets([{...project(1),...patch}],owner));
 assert.throws(()=>calendarProjectTargets([project(1),project(1)],owner));assert.throws(()=>search([{...project(1),id:event.id}]));assert.throws(()=>privateWorkspaceSearch({rows:[event],projectRows:[project(1)],ownerId:owner,values:fields,now}));
});
test('project markers participate in title/date filters and full month counts before fifty-row paging',()=>{
 const rows=Array.from({length:60},(_,i)=>project(i+1));const first=search(rows),next=search(rows,{...fields,offset:50});assert.equal(first.matchCount,61);assert.equal(first.results.length,50);assert.equal(next.results.length,11);verifyCalendarWorkspaceList(next,fields,{now,offset:50});assert.deepEqual(first.monthSummary,next.monthSummary);assert.equal(calendarMonthOverview(first,{now}).days[15].eventCount,61);
 assert.equal(search(rows,{...fields,query:'PRIVATE_DESCRIPTION'}).matchCount,0);assert.equal(search(rows,{...fields,dateFrom:'2026-11-17'}).matchCount,0);
 const leap={...fields,dateFrom:'2028-02-29',dateTo:'2028-02-29'};assert.equal(search([project(100,{day:'2028-02-29'})],leap).results[0].day,'2028-02-29');
});
test('Calendar browser verifier rejects mutation authority and unsupported marker provenance',()=>{
 const good=search([project(1)]);for(const patch of [{projectTarget:false},{projectArea:'Finances'},{projectArea:undefined},{eventEditToken:'e'.repeat(43)},{recordToken:'r'.repeat(43)},{allDay:false},{time:'12:00'},{endDay:'2026-11-17'},{endDateUnavailable:true}])assert.throws(()=>verifyCalendarWorkspaceList({...good,results:[{...good.results[0],...patch},good.results[1]]},fields,{now}));
});
async function http(t){
 const preview=makePrivateSessionPreview({fixtures:true,serveWorkspace:true,allowBriefRead:true,allowSearch:true,allowSearchDates:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true,allowCalendarWorkspace:true,allowProjects:true}),handler=preview.server.listeners('request')[0];t.after(()=>preview.dispose());let cookie='',csrf='';
 async function call(path,body){const req={url:path,method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:5312',origin:'http://127.0.0.1:5312',cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(value){this.body=value;}};await handler(req,res);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data};}
 await call('/auth/workspace/status');await call('/auth/workspace/login',{email:'demo@example.test',password:'fictional-only'});return call;
}
test('protected Calendar derives markers from saved projects and hides them on archive without creating events',async t=>{
 const call=await http(t),today=calendarWorkspaceFields().dateFrom,values={...calendarWorkspaceFields(),query:'Fictional HTTP target'};await call('/auth/workspace/projects/list',{});
 let review=await call('/auth/workspace/projects/review',{action:'create',fields:{title:values.query,description:'PRIVATE_HTTP_DETAILS',section:'School',status:'Active',day:today}});assert.equal(review.status,200);assert.equal((await call('/auth/workspace/projects/save',{reviewId:review.data.reviewId,approved:true})).status,200);
 let calendar=await call('/auth/workspace/calendar',values);assert.equal(calendar.status,200);assert.equal(calendar.data.matchCount,1);assert.equal(calendar.data.results[0].projectTarget,true);assert.equal(calendar.data.results[0].projectArea,'School');assert.equal(calendar.data.results[0].eventEditToken,undefined);assert.equal(calendar.data.results[0].recordToken,undefined);assert.equal((await call('/auth/workspace/search',values)).data.matchCount,0);
 const list=await call('/auth/workspace/projects/list',{}),key=list.data.projects[0].projectToken;review=await call('/auth/workspace/projects/review',{action:'edit',projectToken:key,fields:{title:values.query,description:'PRIVATE_HTTP_DETAILS',section:'School',status:'Active',day:today,archived:true}});assert.equal((await call('/auth/workspace/projects/save',{reviewId:review.data.reviewId,approved:true})).status,200);calendar=await call('/auth/workspace/calendar',values);assert.equal(calendar.data.matchCount,0);assert.equal(calendar.data.monthSummary.days.find(d=>d.day===today)?.count??0,0);
 await call('/auth/workspace/logout',{});assert.equal((await call('/auth/workspace/calendar',values)).status,403);
});
