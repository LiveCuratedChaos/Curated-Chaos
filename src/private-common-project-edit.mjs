import {projectFields} from './private-project-model.mjs';
import {verifySchoolEditView} from './private-school-edit.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function verifyCommonProjectEdit(value,{now=Date.now()}={}){
 const fail=()=>{throw Error('The original record editor could not be verified.');};
 if(!exact(value,['sourceKind','expiresAt','edit'])||!['project','school-degree','school-course'].includes(value.sourceKind)||!Number.isFinite(now)||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+300000||value.edit?.expiresAt!==value.expiresAt)fail();
 if(value.sourceKind==='project'){
  const v=value.edit,keys=['projectToken','expiresAt','title','description','section','status',...(Object.hasOwn(v,'separateRecurring')?['separateRecurring']:[])];
  if(!exact(v,keys)||typeof v.projectToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.projectToken))fail();
  const fields=Object.fromEntries(Object.entries(v).filter(([k])=>!['projectToken','expiresAt'].includes(k))),checked=projectFields(fields);
  if(checked.title!==fields.title)fail();
 }else{verifySchoolEditView(value.edit,{now});if(value.sourceKind!=='school-'+value.edit.kind)fail();}
 return value;
}
