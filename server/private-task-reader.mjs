import {taskPriority} from '../src/task-priorities.mjs';
// Explicit selected-task display only. No mutations, provider data or raw identifiers.
import {randomBytes} from 'node:crypto';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
export function createPrivateTaskReader({api,now=Date.now,allowPriority=false,allowUndated=false}){
 if(typeof allowUndated!=='boolean')throw Error('Explicit undated read scope required.');if(typeof allowPriority!=='boolean')throw Error('Explicit task priority scope required.');
 const states=new Map();let disposed=false;
 function clear(id){clearTimeout(states.get(id)?.timer);states.delete(id);}
 function current(id,token){const state=states.get(id);return Boolean(!disposed&&state&&state.expiresAt>now()&&state.actions.has(token));}
 function begin(contextId,ownerId,expiresAt,maxActions=allowUndated?80:60){
  if(!Number.isInteger(maxActions)||maxActions<1||maxActions>(allowUndated?80:60))throw Error('Bounded task view required.');
  clear(contextId);if(disposed)throw Error('Task reader closed.');
  const state={ownerId,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map()};states.set(contextId,state);
  state.timer=setTimeout(()=>clear(contextId),Math.max(1,state.expiresAt-now()));state.timer.unref?.();
  return row=>{if(!Number.isInteger(row.version)||row.version<1||state.actions.size>=maxActions)return{};const token=randomBytes(32).toString('base64url');state.actions.set(token,{id:row.id,version:row.version,title:row.payload.title,day:row.payload.day??'',done:row.payload.done,section:row.section});return{taskReadToken:token};};
 }
 async function read(contextId,actor,token){
  const state=states.get(contextId),selected=state?.actions.get(token),live=()=>current(contextId,token)&&states.get(contextId)===state;
  if(!live()||state.ownerId!==actor.ownerId||!selected)throw Error('Fetch latest before opening this task.');
  const rows=await api.getPrivateTaskDetails(actor.accessToken,selected.id,actor.ownerId);
  if(!live()||!Array.isArray(rows)||rows.length!==1)throw Error('Task unavailable.');
  const row=rows[0],p=row?.payload;
  if(!row||row.id!==selected.id||row.owner_id!==actor.ownerId||row.visibility!=='private'||row.household_id!==null||row.deleted_at!==null||row.version!==selected.version||row.item_type!=='task'||row.section!==selected.section||p?.title!==selected.title||(p.day??'')!==selected.day||p.done!==selected.done||normalizeCloudRecords([row],actor.ownerId,{allowUndated}).tasks.length!==1)throw Error('Task changed after it was displayed.');
  const description=p.description??'',source=p.subtasks??[];
  if(typeof description!=='string'||description.length>10000||!Array.isArray(source)||source.length>200)throw Error('Task details exceed this view.');
  const valid=source.filter(item=>item&&typeof item.title==='string'&&item.title.trim()&&item.title.length<=140&&typeof item.done==='boolean'),subtasks=valid.slice(0,40).map(item=>({title:item.title,done:item.done}));
  return{title:p.title,day:p.day??'',section:row.section,...(allowPriority?{priority:taskPriority(p.priority)}:{}),completed:p.done,description,subtasks,subtaskCount:source.length,omittedSubtasks:source.length-subtasks.length,readOnly:true,expiresAt:state.expiresAt};
 }
 return{begin,read,current,clear,dispose(){disposed=true;for(const id of states.keys())clear(id);}};
}
