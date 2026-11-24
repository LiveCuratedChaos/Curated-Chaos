// Local preparation only: sparse title/state reads; never reads or replaces record payloads.
import {randomBytes} from 'node:crypto';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const PRIVATE_RECOVERY_DAYS=90;
const duration=PRIVATE_RECOVERY_DAYS*86400000;
function stamp(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Invalid removal time.');return Date.parse(value);}
function deletedEqual(a,b){return a===null?b===null:b!==null&&stamp(a)===stamp(b);}
export function privateRecoveryState(row,ownerId,{allowProjects=false}={}){
 if(typeof allowProjects!=='boolean')throw Error('Explicit project recovery scope required.');
 if(!uuid(ownerId)||!uuid(row?.id)||row.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||!Number.isInteger(row.version)||row.version<1||!['task','note','event',...(allowProjects?['project']:[])].includes(row.item_type)||!({task:['Home','Personal Life','Work','School'],note:['Personal Life'],event:['Calendar'],project:['Home','Personal Life','Work','School']}[row.item_type].includes(row.section))||row.payload?.fictional!==true||typeof row.payload.title!=='string'||!row.payload.title.trim()||row.payload.title.length>200)throw Error('Exact private recovery scope required.');
 if(row.item_type==='project'&&(row.origin!=='PRIVATE_COOKIE_PROJECT'||row.payload.schemaVersion!==1||row.payload.title!==row.payload.title.trim()||row.payload.title.length>140||/[\u0000-\u001f\u007f]/.test(row.payload.title)))throw Error('Exact private project recovery scope required.');
 if(row.deleted_at!==null)stamp(row.deleted_at);
 return{id:row.id,owner_id:row.owner_id,household_id:null,visibility:'private',section:row.section,item_type:row.item_type,version:row.version,deleted_at:row.deleted_at,...(row.item_type==='project'?{origin:row.origin}:{}),payload:{fictional:true,title:row.payload.title,...(row.item_type==='project'?{schemaVersion:1}:{})}};
}
export function createPrivateRecordRecovery({api,now=Date.now,allowWidgetViews=false,allowProjects=false}){
 if(typeof allowProjects!=='boolean')throw Error('Explicit project recovery scope required.');
 if(typeof now!=='function'||['getPrivateRecordState','setPrivateRecordDeletedAt','listPrivateDeletedRecords'].some(key=>typeof api?.[key]!=='function'))throw Error('Explicit sparse recovery API required.');
 const contexts=new Map();let disposed=false;
 if(typeof allowWidgetViews!=='boolean')throw Error('Explicit bounded widget action scope required.');
 function clear(id){const state=contexts.get(id);clearTimeout(state?.timer);contexts.delete(id);}
 function alive(state){return !disposed&&contexts.get(state.contextId)===state&&state.expiresAt>now();}
 function eligible(row){if(row.deleted_at===null)return;const date=stamp(row.deleted_at);if(date>now()||date<now()-duration)throw Error('The 90-day recovery period has ended.');}
 function issue(state,row,expiresAt=state?.expiresAt,maxActions=state?.maxActions){if(!alive(state)||state.actions.size>=maxActions)throw Error('Recovery selection ended.');const record=privateRecoveryState(row,state.ownerId,{allowProjects});eligible(record);const token=randomBytes(32).toString('base64url'),deadline=Math.min(state.expiresAt,expiresAt);if(deadline<=now())throw Error('Recovery selection ended.');state.actions.set(token,record);state.actionExpiries.set(token,deadline);return{recordToken:token};}
 function start(contextId,ownerId,expiresAt,maxActions){const state={contextId,ownerId,expiresAt:Math.min(expiresAt,now()+300000),maxActions,actions:new Map(),actionExpiries:new Map(),review:null};contexts.set(contextId,state);state.timer=setTimeout(()=>clear(contextId),Math.max(1,state.expiresAt-now()));state.timer.unref?.();return state;}
 function begin(contextId,ownerId,expiresAt,maxActions=50){if(!uuid(ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now()||!Number.isInteger(maxActions)||maxActions<1||maxActions>(allowWidgetViews?270:140)||disposed)throw Error('Bounded recovery selection required.');clear(contextId);const state=start(contextId,ownerId,expiresAt,maxActions);return row=>issue(state,row);}
 function add(contextId,ownerId,expiresAt,row){if(!uuid(ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now()||disposed)throw Error('Current recovery selection required.');let state=contexts.get(contextId);if(!state||!alive(state))state=start(contextId,ownerId,expiresAt,allowWidgetViews?270:140);if(state.ownerId!==ownerId||state.review?.claimed)throw Error('Current recovery selection required.');state.maxActions=Math.max(state.maxActions,allowWidgetViews?270:140);const value=issue(state,row,expiresAt,state.maxActions);return{...value,expiresAt:Math.min(state.expiresAt,expiresAt)};}
 async function list(contextId,actor,expiresAt,offset=0){
  if(!Number.isInteger(offset)||offset<0||offset>1950||offset%50)throw Error('Choose a valid recovery page.');
  const issue=begin(contextId,actor.ownerId,expiresAt),state=contexts.get(contextId),rows=await api.listPrivateDeletedRecords(actor.accessToken,actor.ownerId,new Date(now()-duration).toISOString());
  if(!alive(state)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(row=>row?.id)).size!==rows.length)throw Error('Recovery list unverified.');
  const records=rows.map(row=>privateRecoveryState(row,actor.ownerId,{allowProjects}));
  if(records.some(row=>row.deleted_at===null))throw Error('Recovery list contains active records.');
  const recent=records.filter(row=>{const date=stamp(row.deleted_at);return date<=now()&&date>=now()-duration;}).sort((a,b)=>stamp(b.deleted_at)-stamp(a.deleted_at)||a.id.localeCompare(b.id));
  return{retentionDays:PRIVATE_RECOVERY_DAYS,offset,limit:50,matchCount:recent.length,expiresAt:state.expiresAt,records:recent.slice(offset,offset+50).map(row=>({title:row.payload.title,type:row.item_type,section:row.section,deletedAt:new Date(stamp(row.deleted_at)).toISOString(),...issue(row)}))};
 }
 async function get(actor,id){const rows=await api.getPrivateRecordState(actor.accessToken,id,actor.ownerId);if(!Array.isArray(rows)||rows.length!==1)throw Error('Item unavailable.');const row=privateRecoveryState(rows[0],actor.ownerId,{allowProjects});if(row.id!==id)throw Error('Item identity changed.');return row;}
 function same(a,b){return a.id===b.id&&a.owner_id===b.owner_id&&a.version===b.version&&a.section===b.section&&a.item_type===b.item_type&&a.origin===b.origin&&a.payload.schemaVersion===b.payload.schemaVersion&&a.payload.title===b.payload.title&&deletedEqual(a.deleted_at,b.deleted_at);}
 async function prepare(contextId,actor,token){
  const state=contexts.get(contextId),selected=state?.actions.get(token);if(!state||!alive(state)||state.ownerId!==actor.ownerId||!selected||state.actionExpiries.get(token)<=now())throw Error('Fetch latest before reviewing this item.');
  const marker={};state.review=marker;const row=await get(actor,selected.id);if(!alive(state)||state.review!==marker||state.actionExpiries.get(token)<=now()||!same(row,selected))throw Error('Item changed. Fetch latest.');eligible(row);
  const review={record:row,reviewId:randomBytes(32).toString('base64url'),claimed:false,started:false};state.review=review;
  return{reviewId:review.reviewId,title:row.payload.title,type:row.item_type,section:row.section,restoring:row.deleted_at!==null,retentionDays:PRIVATE_RECOVERY_DAYS,expiresAt:state.expiresAt};
 }
 function claim(contextId,ownerId,reviewId){const state=contexts.get(contextId),review=state?.review;if(!state||!alive(state)||state.ownerId!==ownerId||review?.reviewId!==reviewId||review.claimed)throw Error('Recovery review ended.');eligible(review.record);review.claimed=true;return{state,review};}
 async function authorize({state,review},actor){review.authorized=false;if(!alive(state)||state.review!==review||!review.claimed||state.ownerId!==actor.ownerId)return false;eligible(review.record);const row=await get(actor,review.record.id);review.authorized=alive(state)&&state.review===review&&same(row,review.record);return review.authorized;}
 async function save({state,review},actor){
  if(!alive(state)||state.review!==review||!review.claimed||!review.authorized||review.started||state.ownerId!==actor.ownerId)throw Error('Recovery review ended.');eligible(review.record);review.started=true;review.authorized=false;
  const deletedAt=review.record.deleted_at===null?new Date(now()).toISOString():null;
  const rows=await api.setPrivateRecordDeletedAt(actor.accessToken,review.record,actor.ownerId,deletedAt);
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Recovery acknowledgement unverified.');const ack=privateRecoveryState(rows[0],actor.ownerId,{allowProjects}),expected={...review.record,version:ack.version,deleted_at:deletedAt};
  if(ack.version<=review.record.version||!same(ack,expected))throw Error('Recovery acknowledgement unverified.');
  const latest=await get(actor,review.record.id);if(!alive(state)||state.review!==review||!same(latest,ack))throw Error('Recovery reread unverified.');clear(state.contextId);return{saved:true,restored:deletedAt===null};
 }
 return{begin,add,list,prepare,claim,authorize,save,clear,cancelReview(id){const state=contexts.get(id);if(state)state.review=null;},hasAction(id,token){const state=contexts.get(id);return Boolean(state&&alive(state)&&state.actions.has(token)&&state.actionExpiries.get(token)>now());},current(id,reviewId){const state=contexts.get(id);return Boolean(state&&alive(state)&&!state.review?.claimed&&state.review?.reviewId===reviewId);},dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
