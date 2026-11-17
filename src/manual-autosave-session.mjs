// Unmounted routine-edit coordinator. Memory only; not an offline queue or authority.
import {normalizeProjectWorkspace,changeManualProject,changeManualTask} from './project-workspace-model.mjs';
import {stableStringify} from './stable-json.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
export function createManualAutosaveSession({record,projects=[],ownerId,client,newOperationId=()=>crypto.randomUUID(),schedule=setTimeout,cancel=clearTimeout,delayMs=600}={}){
 if(!client||['update','undo','history'].some(k=>typeof client[k]!=='function')||typeof newOperationId!=='function'||typeof schedule!=='function'||typeof cancel!=='function'||!Number.isSafeInteger(delayMs)||delayMs<0||delayMs>60000)throw Error('Manual autosave dependencies required.');
 const original=structuredClone(record),scope=structuredClone(projects);
 const verified=normalizeProjectWorkspace(original?.item_type==='project'?[original]:[...scope,original],ownerId);
 if(!['project','task'].includes(original?.item_type)||scope.some(r=>r?.item_type!=='project')||original.item_type==='task'&&verified.projects.length+verified.tasks.length!==scope.length+1||![...verified.projects,...verified.tasks].some(r=>r.id===original.id))throw Error('Verified manual record required.');
 let current=original,patch={},status='saved',timer=null,timerEpoch=0,closed=false,blocked=false,uncertain=false,active=null,generation=0,lastReceipt=null,lastBefore=null;
 const usedOperations=new Set(),allowed=new Set(original.item_type==='project'?['title','summary']:['title','description','day','priority']);
 function stop(){timerEpoch++;if(timer!==null){cancel(timer);timer=null;}}
 function payload(){return current.item_type==='project'?changeManualProject(current,patch,ownerId):changeManualTask(current,patch,ownerId,scope);}
 function state(){return structuredClone({status,dirty:!closed&&(blocked||Object.keys(patch).length>0),version:current?.version??null,patch,lastReceipt,undoAvailable:!closed&&status==='saved'&&lastBefore!==null});}
 function assess(){
  if(closed)return;stop();if(uncertain){status='uncertain';return;}if(active){status='saving';return;}if(blocked){status='invalid';return;}
  let value;try{value=payload();}catch{status='invalid';return;}
  if(stableStringify(value)===stableStringify(current.payload)){patch={};status='saved';return;}
  status='pending';const ticket=timerEpoch;timer=schedule(()=>{if(!closed&&ticket===timerEpoch){timer=null;void flush();}},delayMs);
 }
 function edit(value){
  if(closed)throw Error('Manual autosave session closed.');
  stop();if(!plain(value)||Object.keys(value).some(k=>!allowed.has(k))){blocked=true;if(!active&&!uncertain)status='invalid';throw Error('Routine manual text, date or priority edit required.');}
  // Never retain unsupported provider/approval/membership/status fields.
  patch={...patch,...structuredClone(value)};blocked=false;assess();return state();
 }
 function flush(){
  if(closed||uncertain)return Promise.resolve(state());if(active)return active;stop();
  let next;try{if(blocked)throw Error();next=payload();}catch{status='invalid';return Promise.resolve(state());}
  if(stableStringify(next)===stableStringify(current.payload)){patch={};status='saved';return Promise.resolve(state());}
  return write('update',next);
 }
 function write(kind,next,targetOperationId){
  let operationId;try{operationId=newOperationId();if(!uuid(operationId)||usedOperations.has(operationId.toLowerCase()))throw Error();usedOperations.add(operationId.toLowerCase());}catch{blocked=true;status='invalid';return Promise.resolve(state());}
  const ticket=generation,expected=structuredClone(current),sent=structuredClone(next);status='saving';
  active=Promise.resolve().then(()=>{
   if(closed||ticket!==generation)throw Error();
   return kind==='undo'?client.undo({operationId,targetOperationId}):client.update({operationId,id:expected.id,expectedVersion:expected.version,payload:structuredClone(sent)});
  }).then(result=>{
   if(closed||ticket!==generation)return;
   const row=result?.record;
   if(result.operationId!==operationId||result.replayed!==false||!row||row.id!==expected.id||row.version!==expected.version+1||row.item_type!==expected.item_type||row.section!==expected.section||stableStringify(row.payload)!==stableStringify(sent))throw Error();
   const checked=normalizeProjectWorkspace(row.item_type==='project'?[row]:[...scope,row],ownerId);
   if(checked.projects.length+checked.tasks.length!==(row.item_type==='project'?1:scope.length+1))throw Error();
   current=structuredClone(row);lastReceipt=structuredClone(result);lastBefore=kind==='update'?expected:null;
   // Keep only newer edits. An acknowledgement must not replace text typed in flight.
   for(const key of Object.keys(patch))if(stableStringify(patch[key])===stableStringify(current.payload[key]))delete patch[key];
  }).catch(()=>{if(!closed&&ticket===generation){uncertain=true;status='uncertain';}}).finally(()=>{
   if(!closed&&ticket===generation){active=null;assess();}
  }).then(state);
  return active;
 }
 function undo(){
  if(closed||uncertain||active||status!=='saved'||!lastBefore)return Promise.resolve(state());
  stop();return write('undo',lastBefore.payload,lastReceipt.operationId);
 }
 function clear(){stop();closed=true;generation++;current=null;patch={};scope.length=0;lastReceipt=null;lastBefore=null;usedOperations.clear();status='closed';}
 return Object.freeze({edit,flush,undo,state,clear});
}
