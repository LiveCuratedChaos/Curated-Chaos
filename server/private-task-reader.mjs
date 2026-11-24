import {normalizeHomeGrocery} from '../src/private-home-grocery.mjs';import {normalizeHomeDelivery,readHomeDelivery} from '../src/private-home-delivery.mjs';
import {taskPriority} from '../src/task-priorities.mjs';
// Explicit selected-task display only. No mutations, provider data or raw identifiers.
import {randomBytes} from 'node:crypto';
import {createPrivateRecordVersionReader} from './private-record-version-reader.mjs';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
export function createPrivateTaskReader({api,now=Date.now,allowWidgetViews=false,allowRoutineViews=false,allowPriority=false,allowUndated=false,allowHomeCleaning=false,allowHomeGroceries=false,allowHomeDeliveries=false,allowRecordHistory=false}){
 if(typeof allowRecordHistory!=='boolean')throw Error('Explicit selected task history scope required.');
 if(typeof allowUndated!=='boolean'||typeof allowHomeCleaning!=='boolean'||typeof allowHomeGroceries!=='boolean'||typeof allowHomeDeliveries!=='boolean')throw Error('Explicit undated read scope required.');if(typeof allowPriority!=='boolean')throw Error('Explicit task priority scope required.');
 const states=new Map();let disposed=false;
 const history=allowRecordHistory?createPrivateRecordVersionReader({api,now,resolveSource:async(id,actor,token)=>({record:await selectedRecord(id,actor,token),expiresAt:states.get(id)?.expiresAt}),describeSnapshot:(row,{expiresAt})=>{if(row.item_type!=='task'||normalizeCloudRecords([{...row,deleted_at:null}],row.owner_id,{allowUndated,allowHomeCleaning,allowHomeGroceries,allowHomeDeliveries}).tasks.length!==1)throw Error('Historical task cannot be displayed.');return describe(row,expiresAt);}}):null;
 if(typeof allowWidgetViews!=='boolean')throw Error('Explicit bounded widget action scope required.');
 function clear(id){history?.clear(id);clearTimeout(states.get(id)?.timer);states.delete(id);}
 function current(id,token){const state=states.get(id);return Boolean(!disposed&&state&&state.expiresAt>now()&&state.actions.has(token));}
 const actionLimit=(allowWidgetViews?210:allowUndated?80:60)+(allowRoutineViews?20:0);
 function begin(contextId,ownerId,expiresAt,maxActions=actionLimit){
  if(!Number.isInteger(maxActions)||maxActions<1||maxActions>actionLimit)throw Error('Bounded task view required.');
  clear(contextId);if(disposed)throw Error('Task reader closed.');
  const state={ownerId,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map()};states.set(contextId,state);
  state.timer=setTimeout(()=>clear(contextId),Math.max(1,state.expiresAt-now()));state.timer.unref?.();
  return row=>{if(!Number.isInteger(row.version)||row.version<1||state.actions.size>=maxActions)return{};const token=randomBytes(32).toString('base64url');state.actions.set(token,{id:row.id,version:row.version,title:row.payload.title,day:row.payload.day??'',done:row.payload.done,section:row.section});return{taskReadToken:token};};
 }
 async function selectedRecord(contextId,actor,token){
  const state=states.get(contextId),selected=state?.actions.get(token),live=()=>current(contextId,token)&&states.get(contextId)===state;
  if(!live()||state.ownerId!==actor.ownerId||!selected)throw Error('Fetch latest before opening this task.');
  const rows=await api.getPrivateTaskDetails(actor.accessToken,selected.id,actor.ownerId);
  if(!live()||!Array.isArray(rows)||rows.length!==1)throw Error('Task unavailable.');
  const row=rows[0],p=row?.payload;
  if(!row||row.id!==selected.id||row.owner_id!==actor.ownerId||row.visibility!=='private'||row.household_id!==null||row.deleted_at!==null||row.version!==selected.version||row.item_type!=='task'||row.section!==selected.section||p?.title!==selected.title||(p.day??'')!==selected.day||p.done!==selected.done||normalizeCloudRecords([row],actor.ownerId,{allowUndated,allowHomeCleaning,allowHomeGroceries,allowHomeDeliveries}).tasks.length!==1)throw Error('Task changed after it was displayed.');
  describe(row,state.expiresAt);return structuredClone(row);
 }
 function describe(row,expiresAt){
  const p=row.payload,description=p.description??'',source=p.subtasks??[];
  if(typeof description!=='string'||description.length>10000||!Array.isArray(source)||source.length>200)throw Error('Task details exceed this view.');
  const valid=source.filter(item=>item&&typeof item.title==='string'&&item.title.trim()&&item.title.length<=140&&typeof item.done==='boolean'),subtasks=valid.slice(0,40).map(item=>({title:item.title,done:item.done}));
  return{title:p.title,day:p.day??'',section:row.section,...(allowHomeCleaning&&row.section==='Home'&&p.homeCleaning?{homeCleaning:p.homeCleaning}:{}),...(allowHomeGroceries&&row.section==='Home'&&p.homeGrocery?{homeGrocery:normalizeHomeGrocery(p.homeGrocery)}:{}),...(allowHomeDeliveries&&row.section==='Home'&&p.homeDelivery?{homeDelivery:normalizeHomeDelivery(p.homeDelivery)}:{}),...(allowPriority?{priority:taskPriority(p.priority)}:{}),completed:p.done,description,subtasks,subtaskCount:source.length,omittedSubtasks:source.length-subtasks.length,readOnly:true,expiresAt};
 }
 async function read(contextId,actor,token){const state=states.get(contextId),row=await selectedRecord(contextId,actor,token);if(states.get(contextId)!==state||!current(contextId,token))throw Error('Task selection ended.');return describe(row,state.expiresAt);}
 return{...(history?{listVersions:(id,actor,token,options)=>history.list(id,actor,token,states.get(id)?.expiresAt,options),readVersion:(id,actor,token)=>history.read(id,actor,token)}:{}),begin,read,selectedRecord:async(id,actor,token)=>{const state=states.get(id),record=await selectedRecord(id,actor,token);if(states.get(id)!==state||!current(id,token))throw Error('Task selection ended.');return{record,expiresAt:state.expiresAt};},current,clear,dispose(){history?.dispose();disposed=true;for(const id of states.keys())clear(id);}};
}
