// Short-lived server-side preview review; no persistence executor exists here.
import {randomUUID} from 'node:crypto';
import {planGoogleSourceImport} from './google-import-plan.mjs';
export function createGoogleImportReview({sealer,connectionStore,confirmSession,importExecutor,canWriteSelection=()=>false,now=()=>Date.now()}){
 const previews=new Map();
 const clean=()=>{for(const [id,row] of previews)if(row.expiresAt<=now())previews.delete(id);};
 return {
  remember({ownerId,binding,connectionId,preview}){
   clean();if(previews.size>=20)throw Error('Preview capacity reached. Wait for older previews to expire.');
   const previewId=randomUUID(),expiresAt=now()+5*60000;
   const encrypted=sealer.seal({ownerId,binding,connectionId,preview},'preview:'+previewId);
   previews.set(previewId,{binding,expiresAt,encrypted});return {previewId,expiresAt};
  },
  forgetSession(binding){for(const [id,row] of previews)if(row.binding===binding)previews.delete(id);},
  async prepareSave({ownerId,binding,previewId,selectedKeys,actor}){
   clean();const stored=previews.get(previewId);
   if(!importExecutor||!stored||stored.binding!==binding||!await confirmSession(ownerId,binding))throw Error('Verified preview and app session required.');
   const data=sealer.unseal(stored.encrypted,'preview:'+previewId);
   if(data.ownerId!==ownerId||data.binding!==binding)throw Error('Preview unavailable.');
   await connectionStore.loadSelected(ownerId,data.connectionId,data.preview.selectionId);
   const args={connectionId:data.connectionId,selectionId:data.preview.selectionId,preview:data.preview,previewExpiresAt:stored.expiresAt,selectedKeys};
   const prepared=await importExecutor.prepare(actor,args);
   if(!previews.has(previewId)||stored.expiresAt<=now()||!await confirmSession(ownerId,binding))throw Error('Preview or app session ended.');
   return {...prepared,saveEnabled:canWriteSelection(args)&&prepared.conflictCount===0&&prepared.insertCount>0};
  },
  async review({ownerId,binding,previewId,selectedKeys}){
   clean();const stored=previews.get(previewId);
   if(!stored||stored.binding!==binding||!await confirmSession(ownerId,binding))throw Error('Preview expired. Read it again before reviewing.');
   const data=sealer.unseal(stored.encrypted,'preview:'+previewId);
   if(data.ownerId!==ownerId||data.binding!==binding)throw Error('Preview unavailable.');
   await connectionStore.loadSelected(ownerId,data.connectionId,data.preview.selectionId);
   const plan=planGoogleSourceImport({ownerId,connectionId:data.connectionId,selectionId:data.preview.selectionId,preview:data.preview,selectedKeys});
   if(!await confirmSession(ownerId,binding)||!previews.has(previewId)||stored.expiresAt<=now())throw Error('App session or preview ended.');
   return {reviewOnly:true,executed:false,requiresApproval:true,selectedCount:plan.actions.length,
    types:[...new Set(plan.actions.map(a=>a.record.item_type))],databaseCompared:false,
    message:'Selection reviewed. Nothing saved. Database comparison and import approval are still required.'};
  }
 };
}
