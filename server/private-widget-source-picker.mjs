import {isPrivateNoteSummary,isPrivateNoteOriginal} from './private-note-source.mjs';
// Current, session-bound selectors for Notes/Projects widget associations.
// Public option DTOs contain titles and short-lived selection capabilities only.
import {randomBytes,randomUUID} from 'node:crypto';
import {privateProjectState} from './private-projects.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const token=()=>randomBytes(32).toString('base64url');
export function createPrivateWidgetSourcePicker({api,now=Date.now}={}){
 if(typeof now!=='function'||['listPrivateBriefRecords','listPrivateProjects','getPrivateNote','getPrivateProject'].some(k=>typeof api?.[k]!=='function'))throw Error('Original private note and project adapters required.');
 const states=new Map();let disposed=false;
 function clear(contextId){const state=states.get(contextId);clearTimeout(state?.timer);states.delete(contextId);}
 function live(state){return !disposed&&states.get(state.contextId)===state&&state.expiresAt>now();}
 function begin(contextId,actor,expiresAt){clear(contextId);if(disposed||typeof contextId!=='string'||!contextId||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Current private widget setup required.');const state={contextId,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),selections:new Map()};states.set(contextId,state);state.timer=setTimeout(()=>clear(contextId),Math.max(1,state.expiresAt-now()));state.timer.unref?.();return state;}
 async function list(contextId,actor,expiresAt){
  const state=begin(contextId,actor,expiresAt);
  try{
   const [noteRows,projectRows]=await Promise.all([api.listPrivateBriefRecords(actor.accessToken,actor.ownerId),api.listPrivateProjects(actor.accessToken,actor.ownerId)]);
   if(!live(state)||!Array.isArray(noteRows)||noteRows.length>2000||!Array.isArray(projectRows)||projectRows.length>250)throw Error();
   const notes=[],projects=[];
   for(const row of noteRows.filter(value=>value?.item_type==='note')){if(!isPrivateNoteSummary(row,state.owner))continue;const selectionToken=token();state.selections.set(selectionToken,{type:'note',id:row.id,version:row.version,title:row.payload.title,section:row.section});notes.push({selectionToken,title:row.payload.title,section:row.section});}
   for(const row of projectRows){let project;try{project=privateProjectState(row,state.owner,{summary:true});}catch{continue;}const selectionToken=token();state.selections.set(selectionToken,{type:'project',id:project.id,version:project.version,title:project.payload.title,section:project.section,status:project.payload.status});projects.push({selectionToken,title:project.payload.title,section:project.section,status:project.payload.status});}
   if(!live(state))throw Error();return{notes,projects,expiresAt:state.expiresAt};
  }catch{if(states.get(contextId)===state)clear(contextId);throw Error('Current private note and project choices could not be verified.');}
 }
 async function selected(contextId,actor,type,selectionToken){
  const state=states.get(contextId),choice=state?.selections.get(selectionToken);if(!state||!live(state)||state.owner!==actor?.ownerId||!choice||choice.type!==type)throw Error('Select a current private source again.');
  const rows=type==='note'?await api.getPrivateNote(actor.accessToken,choice.id,actor.ownerId):type==='project'?await api.getPrivateProject(actor.accessToken,choice.id,actor.ownerId):null;
  if(!live(state)||!Array.isArray(rows)||rows.length!==1)throw Error('Selected private source is unavailable.');const row=rows[0];
  if(type==='note'){if(!isPrivateNoteOriginal(row,actor.ownerId,choice.id)||row.version!==choice.version||row.payload.title!==choice.title)throw Error('Selected note changed. Fetch current sources.');return{type,record:structuredClone(row),expiresAt:state.expiresAt};}
  let project;try{project=privateProjectState(row,actor.ownerId,{summary:true});}catch{throw Error('Selected project changed. Fetch current sources.');}
  if(project.id!==choice.id||project.version!==choice.version||project.payload.title!==choice.title||project.payload.status!==choice.status||project.section!==choice.section)throw Error('Selected project changed. Fetch current sources.');
  return{type,record:structuredClone(row),expiresAt:state.expiresAt};
 }
 async function resolve(contextId,actor,associationId){
  const state=states.get(contextId);if(!state||!live(state)||state.owner!==actor?.ownerId||!uuid(associationId))throw Error('Current private widget source required.');
  if(typeof api.resolveWidgetSourceAssociation!=='function')throw Error('Persistent widget source association adapter required.');
  const matches=await api.resolveWidgetSourceAssociation(actor.accessToken,associationId);if(!live(state)||!Array.isArray(matches)||matches.length>1)throw Error('Widget source association could not be verified.');if(!matches.length)return null;
  const match=matches[0];if(!uuid(match?.record_id)||!['note','project'].includes(match.item_type))throw Error('Widget source association could not be verified.');
  const rows=match.item_type==='note'?await api.getPrivateNote(actor.accessToken,match.record_id,actor.ownerId):await api.getPrivateProject(actor.accessToken,match.record_id,actor.ownerId);if(!live(state)||!Array.isArray(rows)||rows.length!==1)throw Error('Widget source is unavailable.');const row=rows[0];
  if(match.item_type==='note'){if(!isPrivateNoteOriginal(row,actor.ownerId,match.record_id))throw Error('Widget note source is unavailable.');return{associationId,type:'note',title:row.payload.title,section:row.section,record:structuredClone(row),expiresAt:state.expiresAt};}
  const project=privateProjectState(row,actor.ownerId,{summary:true});if(project.id!==match.record_id)throw Error('Widget project source changed.');return{associationId,type:'project',title:project.payload.title,section:project.section,status:project.payload.status,record:structuredClone(row),expiresAt:state.expiresAt};
 }
 async function ready(contextId,actor){const state=states.get(contextId);if(!state||!live(state)||state.owner!==actor?.ownerId)throw Error('Current private widget view required.');const result=await api.resolveWidgetSourceAssociation(actor.accessToken,randomUUID());if(!live(state)||!Array.isArray(result)||result.length>1)throw Error('Persistent widget source protection is unavailable.');return true;}
 return{begin,list,selected,resolve,ready,clear,dispose(){disposed=true;for(const id of states.keys())clear(id);}};
}
