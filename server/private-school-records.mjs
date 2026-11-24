// One-use School creation/association reviews; no browser-selected record IDs.
import {randomBytes,randomUUID} from 'node:crypto';
import {privateSchoolState} from './private-school-read.mjs';
import {schoolDetailContent,verifyPrivateSchoolDetails} from '../src/private-school-read.mjs';
import {schoolCreationPayload,schoolProgramProposal,verifySchoolRecordsView,verifySchoolRecordsReview} from '../src/private-school-records.mjs';
import {stableStringify} from './stable-json.mjs';
const token=()=>randomBytes(32).toString('base64url'),same=(a,b)=>stableStringify(a)===stableStringify(b),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),fail=()=>{throw Error('School source or review changed. Fetch current School records before reviewing again.');};
export function createPrivateSchoolRecords({api,now=Date.now,idFactory=randomUUID}={}){
 if(typeof now!=='function'||typeof idFactory!=='function'||['isPrivateSchoolRecordsReady','listPrivateSchoolSummaries','getPrivateSchoolRecord','createPrivateSchoolRecord','setPrivateSchoolProgram'].some(k=>typeof api?.[k]!=='function'))fail();
 const contexts=new Map();let disposed=false;
 const alive=s=>!disposed&&contexts.get(s.id)===s&&s.expiresAt>now();
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 function state(id,actor){const s=contexts.get(id);if(!s||!alive(s)||s.owner!==actor?.ownerId)fail();return s;}
 function source(row,owner,expiry){const value=privateSchoolState(row,owner);verifyPrivateSchoolDetails({readOnly:true,expiresAt:expiry,...value.fields,...schoolDetailContent(row.payload)},{now:now()});return value;}
 async function ready(s,actor){if(await api.isPrivateSchoolRecordsReady(actor.accessToken)!==true||!alive(s)||s.owner!==actor.ownerId)fail();}
 async function get(s,actor,id){const rows=await api.getPrivateSchoolRecord(actor.accessToken,id,actor.ownerId);if(!alive(s)||!Array.isArray(rows)||rows.length!==1||rows[0].id!==id)fail();source(rows[0],actor.ownerId,s.expiresAt);return structuredClone(rows[0]);}
 function unchanged(before,after,owner,expiry){return same(source(before,owner,expiry),source(after,owner,expiry))&&same(before.payload,after.payload);}
 async function open(id,actor,expiresAt,{course=null}={}){
  if(disposed||typeof id!=='string'||!id||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())fail();clear(id);
  const s={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),viewId:token(),programs:new Map(),course:course?structuredClone(course):null,review:null,generation:0};contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},s.expiresAt-now());s.timer.unref?.();
  try{if(s.course){source(s.course,actor.ownerId,s.expiresAt);if(s.course.payload.kind!=='course')fail();schoolProgramProposal(s.course.payload,s.course.payload.degreeId===''?null:s.course.payload.degreeId);}
   await ready(s,actor);const rows=await api.listPrivateSchoolSummaries(actor.accessToken,actor.ownerId);if(!alive(s)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r?.id)).size!==rows.length)fail();
   for(const row of rows){const snapshot=privateSchoolState(row,actor.ownerId);if(snapshot.fields.kind==='degree')s.programs.set(token(),snapshot);}
   if(s.course){const current=await get(s,actor,s.course.id);if(!unchanged(s.course,current,actor.ownerId,s.expiresAt))fail();}
   return verifySchoolRecordsView({viewId:s.viewId,expiresAt:s.expiresAt,mode:s.course?'association':'create',programs:[...s.programs].map(([programToken,p])=>({programToken,title:p.fields.title})),...(s.course?{course:{title:s.course.payload.title,association:s.course.payload.degreeId?'linked':'unassigned',programTitle:[...s.programs.values()].find(p=>p.id===s.course.payload.degreeId)?.fields.title??(s.course.payload.degreeId?'Program unavailable':'Unassigned')}}:{})},{now:now()});
  }catch(error){if(contexts.get(id)===s)clear(id);throw error;}
 }
 async function prepare(id,actor,value){
  const s=state(id,actor);s.review=null;const generation=++s.generation;
  if(!exact(value,s.course?['viewId','programToken']:['viewId','kind','fields','programToken'])||value.viewId!==s.viewId||typeof value.programToken!=='string')fail();
  const selected=value.programToken?s.programs.get(value.programToken):null;if(value.programToken&&!selected)fail();
  await ready(s,actor);let degree=null;if(selected){degree=await get(s,actor,selected.id);if(!same(privateSchoolState(degree,actor.ownerId),selected))fail();}
  let record=null,payload,recordId;
  if(s.course){record=await get(s,actor,s.course.id);if(!unchanged(s.course,record,actor.ownerId,s.expiresAt))fail();payload=schoolProgramProposal(record.payload,degree?.id??null);recordId=record.id;if(same(record.payload,payload)){if(!alive(s)||s.generation!==generation)fail();return{noChanges:true};}}
  else{payload=schoolCreationPayload(value.kind,value.fields,{degreeId:degree?.id??null});recordId=idFactory();if(!uuid(recordId))fail();}
  if(!alive(s)||s.generation!==generation)fail();const r={id:token(),s,generation,record,recordId,payload,degree,claimed:false,authorized:false,started:false};s.review=r;
  return verifySchoolRecordsReview({reviewId:r.id,expiresAt:s.expiresAt,action:record?'association':'create',kind:payload.kind,fields:record?{title:payload.title,from:s.course.payload.degreeId?s.programs.size?[...s.programs.values()].find(p=>p.id===s.course.payload.degreeId)?.fields.title??'Program unavailable':'Program unavailable':'Unassigned',to:degree?.payload.title??'Unassigned'}:{...structuredClone(value.fields),programTitle:degree?.payload.title??'Unassigned'}},{now:now()});
 }
 function claim(id,owner,reviewId){const s=state(id,{ownerId:owner}),r=s.review;if(!r||r.id!==reviewId||r.claimed)fail();r.claimed=true;s.review=null;return r;}
 async function preflight(r,actor){if(!r?.claimed||!alive(r.s)||r.s.owner!==actor?.ownerId||r.s.generation!==r.generation)fail();await ready(r.s,actor);for(const before of [r.record,r.degree].filter(Boolean)){const fresh=await get(r.s,actor,before.id);if(!unchanged(before,fresh,actor.ownerId,r.s.expiresAt))fail();}if(!alive(r.s)||r.s.generation!==r.generation)fail();}
 async function authorize(r,actor){if(r?.started)return false;r.authorized=false;await preflight(r,actor);r.authorized=true;return true;}
 async function save(r,actor){
  if(!r?.authorized||r.started)fail();r.started=true;await preflight(r,actor);const association={degreeId:r.degree?.id??null,degreeVersion:r.degree?.version??null};
  const result=await(r.record?api.setPrivateSchoolProgram(actor.accessToken,structuredClone(r.record),actor.ownerId,association):api.createPrivateSchoolRecord(actor.accessToken,{recordId:r.recordId,kind:r.payload.kind,payload:structuredClone(r.payload),...association}));
  const rows=Array.isArray(result)?result:[result];if(!alive(r.s)||r.s.generation!==r.generation||rows.length!==1)fail();const ack=rows[0],current=source(ack,actor.ownerId,r.s.expiresAt);
  if(ack.id!==r.recordId||ack.version!==(r.record?r.record.version+1:1)||!same(ack.payload,r.payload))fail();
  if(r.record&&!same({...current,version:r.record.version,updatedAt:privateSchoolState(r.record,actor.ownerId).updatedAt,degreeId:r.record.payload.degreeId},privateSchoolState(r.record,actor.ownerId)))fail();
  const fresh=await get(r.s,actor,r.recordId);if(!unchanged(ack,fresh,actor.ownerId,r.s.expiresAt)||!alive(r.s)||r.s.generation!==r.generation)fail();clear(r.s.id);return{saved:true};
 }
 return{open,prepare,claim,authorize,save,clear,cancel:clear,current:(id,t)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).review?.id===t),currentView:(id,t)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===t),dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
