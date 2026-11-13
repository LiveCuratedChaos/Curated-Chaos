import {createSavedSearchHttpDrill} from './private-saved-search-http-drill.mjs';
// Prepared one-shortcut development drill. No configuration/network access without explicit arguments.
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {assertDevTarget,loadLocalConfig} from './dev-env.mjs';import {createDevApi} from '../src/dev-api.mjs';
import {createPrivateSavedSearches,privateSavedSearchState,savedSearchFilters,SAVED_SEARCH_ORIGIN} from '../server/private-saved-searches.mjs';
import {stableStringify} from '../server/stable-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function validateSavedSearchArguments(argv){
 if(!argv.includes('--allow-fictional-saved-search-test'))return null;
 const withHttp=argv.includes('--with-http');const project=argv.filter(a=>a.startsWith('--project=')),run=argv.filter(a=>a.startsWith('--run='));
 if(argv.length!==4+Number(withHttp)||new Set(argv).size!==4+Number(withHttp)||project.length!==1||run.length!==1||!argv.includes('--fixtures=1')||!uuid(run[0].slice(6))||!/^[a-z0-9]{10,32}$/.test(project[0].slice(10)))throw Error('Exact one-saved-search development approval required.');
 return{project:project[0].slice(10),run:run[0].slice(6),...(withHttp?{withHttp:true}:{})};
}
export async function verifyPrivateSavedSearches({project,run,withHttp=false},{configLoader=loadLocalConfig,apiFactory=createDevApi,fetcher=fetch,log=console.log}={}){
 if(typeof withHttp!=='boolean')throw Error('Explicit browser-request test mode required.');if(!uuid(run))throw Error('Named saved-search drill required.');const config=assertDevTarget(configLoader());if(config.ref!==project)throw Error('Unexpected saved-search target.');
 const base=apiFactory({supabaseUrl:config.url,projectRef:config.ref,publishableKey:config.publishableKey}),sessions=[],actors=[];
 const filters=savedSearchFilters({query:'QA fictional saved query '+run.slice(0,8),type:'task',section:'Work',status:'open',priority:'High',dateFrom:'2026-11-10',dateTo:'2026-11-12',dateStatus:'dated'}),names=['QA fictional shortcut '+run.slice(0,8),'QA renamed shortcut '+run.slice(0,8)];
 let service,attempted=false,cleaned=false,createdAt,inserts=0,renames=0,removals=0,restores=0;
 async function fixture(index,options={},suffix=''){
  const response=await fetcher(config.url+'/rest/v1/cc_records?select=*&id=eq.'+run+suffix,{...options,headers:{apikey:config.publishableKey,Authorization:'Bearer '+sessions[index].accessToken,'Content-Type':'application/json',Prefer:'return=representation'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Fictional saved-search storage request failed.');const rows=await response.json();if(!Array.isArray(rows))throw Error('Fictional saved-search response unverified.');return rows;
 }
 function exact(row){try{privateSavedSearchState(row,actors[0].ownerId);}catch{return false;}return row.id===run&&row.version<=5&&names.includes(row.payload.title)&&Object.keys(row.payload).sort().join(',')==='fictional,filters,schemaVersion,source,title'&&stableStringify(row.payload.filters)===stableStringify(filters)&&(!createdAt||Date.parse(row.created_at)===Date.parse(createdAt));}
 async function check(version,removed,name){const rows=await fixture(0);if(rows.length!==1||!exact(rows[0])||rows[0].version!==version||(rows[0].deleted_at!==null)!==removed||rows[0].payload.title!==name)throw Error('Fictional saved-search state unverified.');return rows[0];}
 async function reject(promise){try{await promise;}catch{return;}throw Error('Forbidden saved-search action accepted.');}
 async function cleanup(){const before=await fixture(0);if(before.length>1||before.some(r=>!exact(r)))throw Error('Fictional saved-search cleanup scope changed.');if(before.length&&before[0].deleted_at===null){const row=before[0],ack=await fixture(0,{method:'PATCH',body:JSON.stringify({deleted_at:new Date().toISOString()})},'&owner_id=eq.'+actors[0].ownerId+'&visibility=eq.private&household_id=is.null&section=eq.Personal%20Life&item_type=eq.saved_search&origin=eq.'+SAVED_SEARCH_ORIGIN+'&version=eq.'+row.version+'&deleted_at=is.null');if(ack.length!==1||!exact(ack[0])||!ack[0].deleted_at||ack[0].version!==row.version+1)throw Error('Fictional saved-search cleanup acknowledgement unverified.');}const after=await fixture(0);if(after.length!==before.length||after.some(r=>!exact(r)||!r.deleted_at))throw Error('Fictional saved-search cleanup reread unverified.');cleaned=true;}
 try{
  for(const user of config.users.slice(0,2)){const signed=await base.signIn(user.email,user.password);sessions.push(signed);const verified=await base.getUser(signed.accessToken);if(!uuid(verified?.id)||!await base.isSessionActive(signed.accessToken))throw Error('Saved-search login unverified.');actors.push({ownerId:verified.id,accessToken:signed.accessToken});}
  if(actors.length!==2||actors[0].ownerId===actors[1].ownerId)throw Error('Two distinct development accounts required.');if((await fixture(0)).length)throw Error('Existing fixture identity; refusing overwrite.');
  function actorFor(token,owner){if(!actors.some(a=>a.ownerId===owner&&a.accessToken===token))throw Error('Unknown saved-search account.');}
  async function writeGuard(token,owner){actorFor(token,owner);if(token!==actors[0].accessToken||owner!==actors[0].ownerId||!await base.isSessionActive(token))throw Error('Saved-search write scope exceeded.');}
  const scopedApi={
   getPrivateSavedSearch:async(token,id,owner)=>{actorFor(token,owner);if(id!==run)throw Error('Only the new shortcut may be read.');return base.getPrivateSavedSearch(token,id,owner);},
   listPrivateSavedSearches:async(token,owner,removed)=>{actorFor(token,owner);return(await base.getPrivateSavedSearch(token,run,owner)).filter(r=>(r.deleted_at!==null)===removed);},
   addPrivateSavedSearch:async(token,record)=>{await writeGuard(token,record.owner_id);if(inserts||record.id!==run||record.payload.title!==names[0]||stableStringify(record.payload.filters)!==stableStringify(filters))throw Error('One new fictional saved search only.');inserts++;attempted=true;return base.addPrivateSavedSearch(token,record);},
   updatePrivateSavedSearch:async(token,record,owner,payload)=>{await writeGuard(token,owner);if(renames||record.id!==run||record.version!==1||!exact(record)||payload.title!==names[1]||stableStringify({...payload,title:names[0]})!==stableStringify(record.payload))throw Error('One fictional shortcut rename only.');renames++;return base.updatePrivateSavedSearch(token,record,owner,payload);},
   setPrivateSavedSearchDeletedAt:async(token,record,owner,deletedAt)=>{await writeGuard(token,owner);if(record.id!==run||!exact(record)||(deletedAt===null?restores||removals!==1||record.version!==3:removals||renames!==1||record.version!==2))throw Error('One fictional removal/restoration only.');if(deletedAt===null)restores++;else removals++;return base.setPrivateSavedSearchDeletedAt(token,record,owner,deletedAt);}
  };
  service=withHttp?await createSavedSearchHttpDrill({base,scopedApi,config,sessions,actors,run}):createPrivateSavedSearches({api:scopedApi,idFactory:()=>run});
  const offer=await service.offer('a',actors[0].ownerId,filters,Date.now()+300000),review=await service.prepare('a',actors[0],{action:'create',name:names[0],saveSearchToken:offer.saveSearchToken});if(inserts||(await fixture(0)).length)throw Error('Review unexpectedly wrote a shortcut.');
  await reject(service.prepare('a',actors[1],{action:'create',name:names[0],saveSearchToken:offer.saveSearchToken}));
  function claim(view){return service.claim('a',actors[0].ownerId,view.reviewId);}
  async function save(view){const c=claim(view);if(!await service.authorize(c,actors[0]))throw Error('Saved-search preflight failed.');const result=await service.save(c,actors[0]);await reject(service.save(c,actors[0]));return result;}
  try{service.claim('a',actors[1].ownerId,review.reviewId);throw Error('Foreign saved-search claim accepted.');}catch(e){if(e.message==='Foreign saved-search claim accepted.')throw e;}
  const c=claim(review);await reject(service.save(c,actors[0]));if(!await service.authorize(c,actors[0]))throw Error('Create preflight failed.');await service.save(c,actors[0]);await reject(service.save(c,actors[0]));createdAt=(await check(1,false,names[0])).created_at;
  if((await fixture(1)).length)throw Error('Other account can read shortcut.');
  let list=await service.list('a',actors[0],Date.now()+300000),other=await service.list('b',actors[1],Date.now()+300000);if(list.records.length!==1||other.records.length)throw Error('Shortcut list privacy failed.');
  await reject(service.load('b',actors[1],list.records[0].savedSearchToken));const loaded=await service.load('a',actors[0],list.records[0].savedSearchToken);if(stableStringify(loaded.filters)!==stableStringify(filters))throw Error('Shortcut filters changed.');
  const rename=await service.prepare('a',actors[0],{action:'rename',savedSearchToken:list.records[0].savedSearchToken,name:names[1]});await check(1,false,names[0]);await save(rename);await check(2,false,names[1]);
  list=await service.list('a',actors[0],Date.now()+300000);await save(await service.prepare('a',actors[0],{action:'remove',savedSearchToken:list.records[0].savedSearchToken}));await check(3,true,names[1]);
  if((await service.list('a',actors[0],Date.now()+300000)).records.length)throw Error('Removed shortcut stayed active.');list=await service.list('a',actors[0],Date.now()+300000,{removed:true});if(list.records.length!==1)throw Error('Removed shortcut not recoverable.');await reject(service.load('a',actors[0],list.records[0].savedSearchToken));
  await save(await service.prepare('a',actors[0],{action:'restore',savedSearchToken:list.records[0].savedSearchToken}));await check(4,false,names[1]);if((await fixture(1)).length)throw Error('Restored shortcut privacy failed.');await cleanup();
 }finally{
  let failed=false;if(attempted&&!cleaned){try{await cleanup();}catch{failed=true;}}try{await service?.dispose();}catch{failed=true;}
  for(const session of sessions){try{if(await base.isSessionActive(session.accessToken))await base.signOutLocal(session.accessToken);if(await base.isSessionActive(session.accessToken))failed=true;}catch{failed=true;}}
  if(failed)throw Error('Saved-search fixture or temporary login cleanup needs review.');
 }
 const report={qaRun:run,verified:true,...(withHttp?{privateBrowserRequestsVerified:true}:{}),fictionalShortcutsCreated:1,renamed:1,removedAndRestored:1,finalFixtureSoftDeleted:true,reviewWasNonWriting:true,oneUseApprovalVerified:true,otherAccountVisibleRows:0,filtersAndCreationTimePreserved:true,closedTemporaryLogins:2,existingRecordWrites:0,providerReads:0};log(JSON.stringify(report));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const args=validateSavedSearchArguments(process.argv.slice(2));if(args)await verifyPrivateSavedSearches(args);else console.log('PLAN ONLY: no configuration, logins, network or records accessed. After approval, a named one-shortcut development drill creates, renames, removes, restores and finally reversibly removes one fictional private saved search, then closes both temporary logins. No existing records, schema, providers, backups or UI activation.');}catch{console.error('Fictional saved-search drill STOPPED. Inspect the named fixture before retrying; cleanup may need review. No credentials or saved queries displayed.');process.exitCode=1;}}
