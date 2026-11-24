// Pure canonical School creation and single-program association contracts.
import {schoolEditFields} from './private-school-edit.mjs';
import {schoolSummaryFields,schoolDetailContent,verifyPrivateSchoolDetails} from './private-school-read.mjs';
import {validateSchoolAcademicIdentities} from './private-school-identities.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,fail=()=>{throw Error('Exact reviewed School record fields required.');};
const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function target(degreeId){if(degreeId!==null&&!uuid(degreeId))fail();return degreeId??'';}
function options(value){if(!plain(value)||Object.keys(value).some(k=>k!=='degreeId'))fail();return Object.hasOwn(value,'degreeId')?value.degreeId:null;}
function known(payload){if(!plain(payload)||payload.fictional!==true||payload.source!=='M2E_SCHOOL_QA'||Object.hasOwn(payload,'schemaVersion')&&payload.schemaVersion!==1)fail();const fields=schoolSummaryFields(payload);validateSchoolAcademicIdentities(payload);if(fields.kind==='course'&&(typeof payload.degreeId!=='string'||payload.degreeId!==''&&!uuid(payload.degreeId)||typeof payload.program!=='string'||payload.program.length>100))fail();verifyPrivateSchoolDetails({readOnly:true,expiresAt:1,...fields,...schoolDetailContent(payload)},{now:0});return payload;}
export function schoolCreationPayload(kind,fields,value={}){const degreeId=options(value),stored=target(degreeId),metadata=schoolEditFields(kind,fields);if(kind==='degree'&&degreeId!==null)fail();return{fictional:true,source:'M2E_SCHOOL_QA',schemaVersion:1,kind,...metadata,...(kind==='course'?{degreeId:stored,program:'',assessments:[],studySessions:[]}: {})};}
export function validateSchoolCreationPayload(kind,payload,value={}){known(payload);if(payload.kind!==kind)fail();const keys=kind==='degree'?['title','progressMetric','totalCredits','totalTerms','targetDate']:['title','code','term','status','credits','officialOrder','studyOrder','targetDate','notes'];const expected=schoolCreationPayload(kind,Object.fromEntries(keys.map(k=>[k,payload[k]])),value);if(!equal(expected,payload))fail();return structuredClone(payload);}
export function schoolProgramProposal(payload,degreeId){known(payload);if(payload.kind!=='course')fail();const selected=target(degreeId);if(payload.degreeId!==''&&selected!==''&&selected!==payload.degreeId)fail();return{...structuredClone(payload),degreeId:selected};}
export function validateSchoolProgramProposal(before,after){known(after);if(!plain(after)||after.kind!=='course')fail();const expected=schoolProgramProposal(before,after.degreeId===''?null:after.degreeId);if(!equal(expected,after))fail();return structuredClone(after);}

const exact=(v,keys)=>plain(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),cap=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v),title=v=>typeof v==='string'&&v.length<=140&&v.trim().length>0;
function currentExpiry(expiresAt,now){if(!Number.isFinite(now)||!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+300000)fail();}
export function verifySchoolRecordsView(value,{now=Date.now()}={}){
 if(!plain(value)||!['create','association'].includes(value.mode)||!exact(value,['viewId','expiresAt','mode','programs',...(value.mode==='association'?['course']:[])])||!cap(value.viewId)||!Array.isArray(value.programs)||value.programs.length>2000)fail();currentExpiry(value.expiresAt,now);
 const seen=new Set();for(const p of value.programs){if(!exact(p,['programToken','title'])||!cap(p.programToken)||seen.has(p.programToken)||!title(p.title))fail();seen.add(p.programToken);}
 if(value.mode==='association'){const c=value.course;if(!exact(c,['title','association','programTitle'])||!title(c.title)||!title(c.programTitle)||!['linked','unassigned'].includes(c.association)||c.association==='unassigned'&&c.programTitle!=='Unassigned')fail();}
 return value;
}
export function verifySchoolRecordsReview(value,{now=Date.now()}={}){
 if(!exact(value,['reviewId','expiresAt','action','kind','fields'])||!cap(value.reviewId)||!['create','association'].includes(value.action)||!['degree','course'].includes(value.kind))fail();currentExpiry(value.expiresAt,now);
 if(value.action==='association'){if(value.kind!=='course'||!exact(value.fields,['title','from','to'])||!['title','from','to'].every(k=>title(value.fields[k])))fail();}
 else{if(!plain(value.fields)||!Object.hasOwn(value.fields,'programTitle')||!title(value.fields.programTitle)||value.kind==='degree'&&value.fields.programTitle!=='Unassigned')fail();const {programTitle,...metadata}=value.fields;schoolEditFields(value.kind,metadata);}
 return value;
}
