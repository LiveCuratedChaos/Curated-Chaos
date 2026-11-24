// Unmounted contract for a future native/manual operation receipt adapter.
// It validates original records and never converts or writes either source.
import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {normalizeProjectWorkspace} from '../src/project-workspace-model.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const digest=value=>createHash('sha256').update(stableStringify(value)).digest('hex');
const fail=()=>{throw Error('Workspace operation could not be verified.');};

function identity(value){if(typeof value!=='string'||!UUID.test(value))fail();return value.toLowerCase();}
function provenance(row){
 if(row.origin==='CC_MANUAL_WORKSPACE'&&row.payload?.source==='manual'&&row.payload?.fictional===false&&row.payload?.schemaVersion===1)return'manual';
 if(row.origin==='PRIVATE_COOKIE_PROJECT'&&row.item_type==='project'&&row.payload?.fictional===true&&row.payload?.schemaVersion===1)return'native';
 if(row.origin==='PRIVATE_COOKIE_TASK_CREATE'&&row.item_type==='task'&&row.payload?.fictional===true)return'native';
 fail();
}
function record(row,ownerId,manualProjects=[]){
 const owner=identity(ownerId),id=identity(row?.id);
 if(row.owner_id!==owner||row.household_id!==null||row.visibility!=='private'||row.deleted_at!==null||!['task','project'].includes(row.item_type)||!Number.isSafeInteger(row.version)||row.version<1||!plain(row.payload))fail();
 const source=provenance(row);
 if(source==='manual'){
  if(!Array.isArray(manualProjects))fail();
  const normalized=normalizeProjectWorkspace(row.item_type==='project'?[row]:[...manualProjects,row],owner);
  if(row.item_type==='project'&&!normalized.projects.some(value=>value.id===id)||row.item_type==='task'&&!normalized.tasks.some(value=>value.id===id))fail();
 }
 if(row.item_type==='project'&&(!['Home','Personal Life','Work','School'].includes(row.section)||typeof row.payload.title!=='string'||!row.payload.title.trim()))fail();
 if(row.item_type==='task'&&(!['Home','Personal Life','Work','School'].includes(row.section)||typeof row.payload.title!=='string'||!row.payload.title.trim()||typeof row.payload.done!=='boolean'))fail();
 return{ownerId:owner,id,version:row.version,source,itemType:row.item_type,section:row.section,row};
}
function relationships(itemType,{taskProjectIds=[],projectMasterIds=[]}={}){
 if(!Array.isArray(taskProjectIds)||!Array.isArray(projectMasterIds))fail();
 const tasks=taskProjectIds.map(identity),masters=projectMasterIds.map(identity);
 if(new Set(tasks).size!==tasks.length||new Set(masters).size!==masters.length||tasks.length>50||masters.length>1)fail();
 if(itemType==='task'&&masters.length||itemType==='project'&&tasks.length)fail();
 return itemType==='task'?{taskProjectIds:tasks.sort()}:{projectMasterIds:masters.sort()};
}
function immutablePayload(itemType,payload){
 const mutable=itemType==='task'?new Set(['title','description','day','priority']):new Set(['title','description','summary','status']);
 return Object.fromEntries(Object.entries(payload).filter(([key])=>!mutable.has(key)));
}
function sourceSnapshot(before,after,ownerId,links,manualProjects){
 const a=record(before,ownerId,manualProjects),b=record(after,ownerId,manualProjects);
 if(a.id!==b.id||a.ownerId!==b.ownerId||a.source!==b.source||a.itemType!==b.itemType||a.version+1!==b.version||a.section!==b.section)fail();
 if(stableStringify(immutablePayload(a.itemType,b.row.payload))!==stableStringify(immutablePayload(a.itemType,a.row.payload)))fail();
 if(!plain(links)||!plain(links.before)||!plain(links.after))fail();
 const beforeLinks=relationships(a.itemType,links.before),afterLinks=relationships(a.itemType,links.after);
 if(stableStringify(beforeLinks)!==stableStringify(afterLinks))fail();
 const relation=afterLinks;
 return{ownerId:a.ownerId,recordId:a.id,provenance:a.source,itemType:a.itemType,section:a.section,expectedVersion:a.version,resultVersion:b.version,
   beforeDigest:digest(a.row),afterDigest:digest(b.row),relationshipDigest:digest(relation),
   recurrenceDigest:a.itemType==='task'?digest({recurrence:a.row.payload.recurrence??null,stopped:a.row.payload.recurrenceStopped??false,completion:a.row.payload.recurrence_completion??null}):null};
}
function verifiedIntent(value){
 const fields=['schemaVersion','operationId','kind','ownerId','recordId','provenance','itemType','section','expectedVersion','resultVersion','beforeDigest','afterDigest','relationshipDigest','recurrenceDigest','intentDigest'];
 if(!plain(value)||Object.keys(value).sort().join(',')!==[...fields].sort().join(',')||value.schemaVersion!==1||!['task.edit','project.edit'].includes(value.kind)||!['native','manual'].includes(value.provenance)||!['task','project'].includes(value.itemType)||value.kind!==`${value.itemType}.edit`||!['Home','Personal Life','Work','School'].includes(value.section))fail();
 identity(value.operationId);identity(value.ownerId);identity(value.recordId);
 if(!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion<1||value.resultVersion!==value.expectedVersion+1||![value.beforeDigest,value.afterDigest,value.relationshipDigest].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||value.itemType==='task'&&!(typeof value.recurrenceDigest==='string'&&/^[a-f0-9]{64}$/.test(value.recurrenceDigest))||value.itemType==='project'&&value.recurrenceDigest!==null)fail();
 const{intentDigest,...body}=value;if(typeof intentDigest!=='string'||intentDigest!==digest(body))fail();return value;
}

/** Build the private transaction intent. This is a contract candidate only. */
export function buildWorkspaceOperationIntent({operationId,ownerId,kind,before,after,relationships:links={before:{},after:{}},manualProjects=[]}={}){
 const op=identity(operationId);
 if(!['task.edit','project.edit'].includes(kind))fail();
 const source=sourceSnapshot(before,after,ownerId,links,manualProjects);
 if(kind!==`${source.itemType}.edit`)fail();
 const intent={schemaVersion:1,operationId:op,kind,...source};
 return Object.freeze({...intent,intentDigest:digest(intent)});
}

/** Validate a transaction acknowledgement without returning record contents. */
export function verifyWorkspaceOperationReceipt(receipt,intent,{now=Date.now,maxAgeMs=300000}={}){
 if(!plain(receipt)||!plain(intent)||typeof now!=='function'||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>300000)fail();
 verifiedIntent(intent);
 const required=['schemaVersion','operationId','ownerId','kind','recordId','provenance','itemType','resultVersion','intentDigest','afterDigest','relationshipDigest','recurrenceDigest','createdAt','replayed'];
 if(Object.keys(receipt).sort().join(',')!==[...required].sort().join(',')||receipt.schemaVersion!==1||receipt.operationId!==intent.operationId||receipt.ownerId!==intent.ownerId||receipt.kind!==intent.kind||receipt.recordId!==intent.recordId||receipt.provenance!==intent.provenance||receipt.itemType!==intent.itemType||receipt.resultVersion!==intent.resultVersion||receipt.intentDigest!==intent.intentDigest||receipt.afterDigest!==intent.afterDigest||receipt.relationshipDigest!==intent.relationshipDigest||receipt.recurrenceDigest!==intent.recurrenceDigest||typeof receipt.replayed!=='boolean')fail();
 const at=Date.parse(receipt.createdAt);if(!Number.isFinite(at)||at>now()||now()-at>maxAgeMs)fail();
 return Object.freeze({operationId:receipt.operationId,ownerId:receipt.ownerId,recordId:receipt.recordId,kind:receipt.kind,resultVersion:receipt.resultVersion,createdAt:new Date(at).toISOString(),replayed:receipt.replayed});
}

/** A replay is accepted only for the identical owner-bound intent. */
export function verifyWorkspaceOperationReplay(receipt,intent,options){
 const verified=verifyWorkspaceOperationReceipt(receipt,intent,options);
 if(receipt.replayed!==true)fail();
 return verified;
}
