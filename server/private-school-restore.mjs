// Recovery eligibility only. Never inserts, updates, relinks or normalizes source records.
import {privateSchoolState} from './private-school-read.mjs';
import {schoolDetailContent,verifyPrivateSchoolDetails} from '../src/private-school-read.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function supportsPrivateSchoolRestore(row){
 try{
  const state=privateSchoolState(row,row?.owner_id),p=row.payload;
  if(row.archived===true||Object.hasOwn(p,'archived')&&p.archived!==false)return false;
  verifyPrivateSchoolDetails({readOnly:true,expiresAt:1,...state.fields,...schoolDetailContent(p)},{now:0});return true;
 }catch{return false;}
}
export function validatePrivateSchoolRestoreAssociations({inserts,existing,allowDeletedRecords=false}={}){
 if(typeof allowDeletedRecords!=='boolean')throw Error('Explicit deleted School recovery scope required.');
 const supported=row=>supportsPrivateSchoolRestore(allowDeletedRecords&&row?.deleted_at!==null?{...row,deleted_at:null}:row);
 if(![inserts,existing].every(rows=>Array.isArray(rows)&&rows.length<=2000)||[...inserts,...existing].some(row=>!uuid(row?.id))||new Set([...inserts,...existing].map(row=>row.id)).size!==inserts.length+existing.length)throw Error('Complete unambiguous School recovery inventory required.');
 const targets=new Map([...existing,...inserts].map(row=>[row.id,row]));let blocked=0;
 for(const row of inserts){
  if(row.item_type!=='school_fixture'||row.payload?.kind!=='course')continue;
  if(!supported(row)){blocked++;continue;}
  const degreeId=row.payload.degreeId;if(degreeId==='')continue;
  const degree=targets.get(degreeId);
  if(!degree||degree.owner_id!==row.owner_id||degree.payload?.kind!=='degree'||row.deleted_at===null&&degree.deleted_at!==null||!supported(degree))blocked++;
 }
 return blocked;
}

// Stable dependency ordering changes insertion order only, never archived records.
export function orderPrivateSchoolRestoreRows(rows){if(!Array.isArray(rows))throw Error('Reviewed recovery insertion list required.');const rank=row=>row.item_type==='school_fixture'&&row.payload?.kind==='degree'?0:1;return[...rows].sort((a,b)=>rank(a)-rank(b));}

// History-bearing courses must never be restored into an unprotected destination.
export function assessmentHistoryRestoreCount(rows){return rows.filter(r=>r.item_type==='school_fixture'&&r.payload?.kind==='course'&&[...(r.payload.assessments??[]),...(r.payload.removedAcademicRecords??[]).filter(e=>e.kind==='assessment').map(e=>e.record)].some(a=>Object.hasOwn(a,'learningRecord'))).length;}
