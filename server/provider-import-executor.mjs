import {stableStringify} from './stable-json.mjs';
// Not wired to the app. Separate preparation/approval and atomic insert-only execution.
import {randomUUID,createHash} from 'node:crypto';
import {planGoogleSourceImport} from './google-import-plan.mjs';
const digest=plan=>createHash('sha256').update(stableStringify(plan)).digest('hex');
const signature=row=>stableStringify([row.id,row.owner_id,row.household_id,row.visibility,row.section,row.item_type,row.origin,row.payload]);
export function createProviderImportExecutor({repository,resolveActor,planImport=planGoogleSourceImport,validateSourceSelection=async()=>{},authorizeWrite=async()=>false,now=()=>Date.now()}){
 const reviews=new Map();
 function forgetReview(id){clearTimeout(reviews.get(id)?.timer);reviews.delete(id);}
 async function session(actor){const s=await resolveActor(actor);if(!s?.ownerId||typeof s.sessionBinding!=='string'||s.sessionBinding.length<16)throw Error('Verified app session required.');return s;}
 async function current(actor,s,args){
  await validateSourceSelection(actor,s,args);
  const proposed=planImport({...args,ownerId:s.ownerId});
  const existing=await repository.readByIds(actor,s.ownerId,proposed.actions.map(a=>a.record.id));
  return planImport({...args,ownerId:s.ownerId,existing});
 }
 return {
  forgetSession(binding){for(const [id,row] of reviews)if(row.binding===binding)forgetReview(id);},
  async prepare(actor,args){
   for(const [id,row] of reviews)if(row.expiresAt<=now())forgetReview(id);
   if(reviews.size>=20)throw Error('Too many pending reviews.');
   const s=await session(actor),plan=await current(actor,s,args),again=await session(actor);
   if(again.ownerId!==s.ownerId||again.sessionBinding!==s.sessionBinding)throw Error('App session changed.');
   const reviewId=randomUUID(),expiresAt=Math.min(now()+300000,Number.isFinite(args.previewExpiresAt)?args.previewExpiresAt:Infinity);
   if(expiresAt<=now())throw Error('Source preview expired.');
   // Snapshot caller data so later browser/controller mutation cannot change approval.
   const entry={ownerId:s.ownerId,binding:s.sessionBinding,args:structuredClone(args),digest:digest(plan),expiresAt};entry.timer=setTimeout(()=>{if(reviews.get(reviewId)===entry)forgetReview(reviewId);},Math.max(0,expiresAt-now()));entry.timer.unref?.();reviews.set(reviewId,entry);
   return {reviewId,expiresAt,insertCount:plan.actions.filter(a=>a.action==='insert').length,unchangedCount:plan.actions.filter(a=>a.action==='unchanged').length,conflictCount:plan.actions.filter(a=>a.action==='review-update').length,executed:false};
  },
  async execute(actor,{reviewId,approved}){
   if(approved!==true)throw Error('Explicit save approval required.');
   const row=reviews.get(reviewId);if(!row||row.expiresAt<=now()){forgetReview(reviewId);throw Error('Review expired or already used.');}
   const s=await session(actor);if(s.ownerId!==row.ownerId||s.sessionBinding!==row.binding)throw Error('Review belongs to a different session.');
   // Claim before awaiting database reads, preventing double-submit execution.
   if(reviews.get(reviewId)!==row)throw Error('Review already used.');forgetReview(reviewId);
   const plan=await current(actor,s,row.args);
   if(digest(plan)!==row.digest||plan.actions.some(a=>a.action==='review-update'))throw Error('Saved data changed or requires conflict review. Prepare a fresh review.');
   const inserts=plan.actions.filter(a=>a.action==='insert').map(a=>a.record);
   const verified=await session(actor);if(verified.ownerId!==s.ownerId||verified.sessionBinding!==s.sessionBinding||row.expiresAt<=now())throw Error('App session or review ended before saving.');
   await validateSourceSelection(actor,s,row.args);
   if(!await authorizeWrite(actor,row.args))throw Error('This source selection has not been approved for database writes.');
   const ready=await session(actor);if(ready.ownerId!==s.ownerId||ready.sessionBinding!==s.sessionBinding||row.expiresAt<=now())throw Error('App session or review ended before saving.');
   if(inserts.length){
    let saved;try{saved=await repository.insertMany(actor,s.ownerId,inserts);}catch{throw Error('Save not confirmed. Review current records before retrying.');}
    if(!Array.isArray(saved)||saved.length!==inserts.length||inserts.some(record=>saved.filter(r=>signature(r)===signature(record)&&Number.isInteger(r.version)&&r.version>=1&&r.deleted_at==null).length!==1))throw Error('Save acknowledgement could not be verified. Review current records before retrying.');
   }
   const after=await repository.readByIds(actor,s.ownerId,plan.actions.map(a=>a.record.id));
   if(plan.actions.some(({record})=>after.filter(r=>signature(r)===signature(record)&&r.deleted_at==null).length!==1))throw Error('Saved contents could not be verified. Review current records before retrying.');
   const final=await session(actor);if(final.ownerId!==s.ownerId||final.sessionBinding!==s.sessionBinding)throw Error('App session ended. Review current records after signing in again.');
   return {executed:true,inserted:inserts.length,unchanged:plan.actions.length-inserts.length,verifiedAt:new Date(now()).toISOString()};
  }
 };
}
