// Explicit opt-in atomic RPC only. No fallback PATCH/POST pair, upsert or retry.
import {validateTaskRecurrence} from './task-recurrence.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const day=v=>typeof v==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function createPrivateRecurringChoreApi(request){if(typeof request!=='function')throw Error('Explicit recurring transport required.');return{
 async completeRecurringChore(token,review){
  if(typeof token!=='string'||!token||/[\s\u007f]/.test(token)||!review||Object.keys(review).sort().join(',')!=='nextDay,operationId,recordId,reviewDay,schedule,successorId,version'||![review.recordId,review.operationId,review.successorId].every(uuid)||review.successorId===review.recordId||!Number.isInteger(review.version)||review.version<1||!day(review.nextDay)||!day(review.reviewDay))throw Error('Exact reviewed recurring completion required.');
  const schedule=validateTaskRecurrence(review.schedule),result=await request('/rest/v1/rpc/cc_complete_recurring_chore',{method:'POST',body:JSON.stringify({p_record_id:review.recordId,p_version:review.version,p_schedule:schedule,p_next_day:review.nextDay,p_review_day:review.reviewDay,p_operation_id:review.operationId,p_successor_id:review.successorId})},token);
  if(result?.projectLinkCount!==undefined&&(!Number.isInteger(result.projectLinkCount)||result.projectLinkCount<0||result.projectLinkCount>50))throw Error('Inherited project link acknowledgement unavailable.');if(!result||Array.isArray(result)||typeof result.alreadySaved!=='boolean'||!result.completedRecord||!result.nextRecord)throw Error('Atomic recurring save acknowledgement unavailable. Check latest before retrying.');return result;
 }
};}
