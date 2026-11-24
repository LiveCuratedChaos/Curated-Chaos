// Explicit School metadata only. Associations and nested academic records are not editable here.
import {schoolSummaryFields,verifyPrivateSchoolDetails} from './private-school-read.mjs';
const degree=['title','progressMetric','totalCredits','totalTerms','targetDate'],course=['title','code','term','status','credits','officialOrder','studyOrder','targetDate','notes'];
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),fail=()=>{throw Error('Supported School metadata fields required.');};
export function schoolEditFields(kind,fields){const keys=kind==='degree'?degree:kind==='course'?course:null;if(!keys||!exact(fields,keys))fail();schoolSummaryFields({kind,...fields});if(fields.title!==fields.title.trim()||/[\u0000-\u001f\u007f]/.test(fields.title)||kind==='course'&&(typeof fields.notes!=='string'||fields.notes.length>1200))fail();return structuredClone(fields);}
export function schoolEditSourceFields(payload){return schoolEditFields(payload.kind,Object.fromEntries((payload.kind==='degree'?degree:course).map(key=>[key,payload[key]])));}
export function verifySchoolEditView(v,{now=Date.now()}={}){if(!exact(v,['editToken','expiresAt','kind','fields'])||typeof v.editToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.editToken)||!Number.isFinite(now)||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+300000)fail();schoolEditFields(v.kind,v.fields);return v;}
export function verifySchoolEditReview(v,{now=Date.now()}={}){if(!exact(v,['reviewId','expiresAt','kind','fields','changes'])||typeof v.reviewId!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.reviewId)||!Number.isFinite(now)||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+300000)fail();schoolEditFields(v.kind,v.fields);if(!Array.isArray(v.changes)||!v.changes.length||new Set(v.changes.map(c=>c.field)).size!==v.changes.length||v.changes.some(c=>!exact(c,['field','before','after'])||!Object.hasOwn(v.fields,c.field)||JSON.stringify(c.after)!==JSON.stringify(v.fields[c.field])||JSON.stringify(c.before)===JSON.stringify(c.after)))fail();return v;}
export const schoolMetadataFields=schoolEditFields;
export const schoolMetadataFromPayload=schoolEditSourceFields;
export function schoolMetadataProposal(payload,fields){return{...structuredClone(payload),...schoolEditFields(payload.kind,fields)};}
// A saved read-only version can supply metadata values only; current source and writer stay authoritative.
export function schoolHistoricalMetadataDraft(currentView,historical,{now=Date.now()}={}){
 verifySchoolEditView(currentView,{now});verifyPrivateSchoolDetails(historical,{now});if(currentView.kind!==historical.kind)fail();return schoolEditSourceFields(historical);
}
