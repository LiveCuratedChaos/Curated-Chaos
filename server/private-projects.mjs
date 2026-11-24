import {applicationSummary,careerFold,goalFilters,goalSummary,pipelineFilters} from '../src/private-career-pipeline.mjs';
import {noteChoices,currentProjectNote,proposedNoteLink} from './private-work-note-links.mjs';
import {projectNoteIds} from '../src/private-project-note-fields.mjs';
import {applicationMailPage,mailEvidence} from './private-application-mail.mjs';
import {receiptChoices,selectedReceipt,downloadReceipt} from './private-receipt-files.mjs';
// Private project metadata only. No task status/link changes, household access or deletion.
import {randomBytes,randomUUID} from 'node:crypto';import {projectFields,PROJECT_AREAS,PROJECT_STATUSES} from '../src/private-project-model.mjs';import {privateCareerFields} from '../src/private-career-fields.mjs';import {readHomeAsset} from '../src/private-home-asset.mjs';import {stableStringify} from './stable-json.mjs';
export const PROJECT_ORIGIN='PRIVATE_COOKIE_PROJECT';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),token=()=>randomBytes(32).toString('base64url');
export function privateProjectState(row,owner,{summary=false}={}){
 const p=row?.payload;if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.household_id!==null||row.visibility!=='private'||row.item_type!=='project'||row.origin!==PROJECT_ORIGIN||row.deleted_at!==null||!PROJECT_AREAS.includes(row.section)||!Number.isInteger(row.version)||row.version<1||!(typeof row.created_at==='string'||row.created_at instanceof Date)||!Number.isFinite(new Date(row.created_at).getTime())||!p||p.fictional!==true||p.schemaVersion!==1||typeof p.title!=='string'||p.title!==p.title.trim()||!p.title||p.title.length>140||/[\u0000-\u001f\u007f]/.test(p.title)||!PROJECT_STATUSES.includes(p.status))throw Error('Private project scope unavailable.');if(Object.hasOwn(p,'separateRecurring')&&typeof p.separateRecurring!=='boolean')throw Error('Supported project progress option required.');if(Object.hasOwn(p,'career')&&(row.section!=='Work'||!privateCareerFields(p.career,{requireCanonical:true})))throw Error('Supported private career details required.');if(Object.hasOwn(p,'homeAsset')&&(row.section!=='Home'||!readHomeAsset(p.homeAsset)))throw Error('Supported private Home asset details required.');
 projectNoteIds(row);
 if(!summary&&(Object.keys(p).filter(k=>!['separateRecurring','career','homeAsset','noteIds'].includes(k)).sort().join(',')!=='description,fictional,schemaVersion,status,title'||!(typeof row.updated_at==='string'||row.updated_at instanceof Date)||!Number.isFinite(new Date(row.updated_at).getTime())||projectFields({title:p.title,description:p.description,status:p.status,section:row.section,...(Object.hasOwn(p,'career')?{career:p.career}:{}),...(Object.hasOwn(p,'homeAsset')?{homeAsset:p.homeAsset}:{})}).description!==p.description))throw Error('Complete supported project fields required.');return structuredClone(row);
}
const view=row=>({title:row.payload.title,description:row.payload.description,status:row.payload.status,section:row.section,...(Object.hasOwn(row.payload,'separateRecurring')?{separateRecurring:row.payload.separateRecurring}:{}),...(Object.hasOwn(row.payload,'career')?{career:row.payload.career}:{}),...(Object.hasOwn(row.payload,'homeAsset')?{homeAsset:row.payload.homeAsset}:{})});
const same=(a,b)=>a.id===b.id&&a.owner_id===b.owner_id&&a.version===b.version&&a.section===b.section&&a.origin===b.origin&&stableStringify(a.payload)===stableStringify(b.payload)&&new Date(a.created_at).getTime()===new Date(b.created_at).getTime();
export function createPrivateProjects({api,now=Date.now,idFactory=randomUUID,documentStorage=null,allowSavedMail=false,readLinkedNote=null,readColors=null}={}){
 if(['getPrivateProject','listPrivateProjects','addPrivateProject','updatePrivateProject'].some(k=>typeof api?.[k]!=='function')||typeof now!=='function'||typeof idFactory!=='function')throw Error('Explicit private project API required.');const contexts=new Map();let disposed=false;
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}const alive=s=>!disposed&&contexts.get(s.contextId)===s&&s.expiresAt>now();
 function begin(contextId,ownerId,expiresAt){clear(contextId);if(disposed||typeof contextId!=='string'||!contextId||!uuid(ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Active project context required.');const s={contextId,ownerId,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map(),review:null,generation:0,viewId:token()};contexts.set(contextId,s);s.timer=setTimeout(()=>clear(contextId),s.expiresAt-now());s.timer.unref?.();return s;}
 function state(id,actor){const s=contexts.get(id);if(!s||!alive(s)||s.ownerId!==actor.ownerId)throw Error('Fetch projects again.');return s;}
 async function get(actor,id){const rows=await api.getPrivateProject(actor.accessToken,id,actor.ownerId);if(!Array.isArray(rows)||rows.length!==1)throw Error('Selected project unavailable.');const row=privateProjectState(rows[0],actor.ownerId);if(row.id!==id)throw Error('Project identity changed.');return row;}
 async function list(contextId,actor,expiresAt,{offset=0,query='',section='all',status='all'}={}){if(typeof query!=='string'||query.trim().length>100||!['all',...PROJECT_AREAS].includes(section)||!['all',...PROJECT_STATUSES].includes(status)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50)throw Error('Supported project page required.');const s=begin(contextId,actor.ownerId,expiresAt),[rows,display]=await Promise.all([api.listPrivateProjects(actor.accessToken,actor.ownerId),readColors?.(actor)]);if(!alive(s)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Project list unavailable.');const all=rows.map(r=>privateProjectState(r,actor.ownerId,{summary:true})).filter(r=>(section==='all'||r.section===section)&&(status==='all'||r.payload.status===status)&&r.payload.title.normalize('NFKC').toLocaleLowerCase('en-US').includes(query.trim().normalize('NFKC').toLocaleLowerCase('en-US'))).sort((a,b)=>a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));if(offset>0&&offset>=all.length)throw Error('Projects changed; fetch the first page.');const projects=all.slice(offset,offset+50).map(row=>{const projectToken=token();s.actions.set(projectToken,row);return{projectToken,title:row.payload.title,status:row.payload.status,section:row.section,...display?.(row)};});return{projects,query:query.trim(),section,status,matchCount:all.length,offset,limit:50,viewId:s.viewId,expiresAt:s.expiresAt};}
 async function pipeline(contextId,actor,expiresAt,values){
  const {query,stage,offset}=pipelineFilters(values),s=begin(contextId,actor.ownerId,expiresAt);
  const rows=await api.listPrivateProjects(actor.accessToken,actor.ownerId,{applications:true});
  if(!alive(s)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Application inventory changed.');
  const stages=new Map(),matches=[],term=careerFold(query);
  for(const raw of rows){
   const row=privateProjectState(raw,actor.ownerId,{summary:true}),app=applicationSummary(row.application);
   if(row.section!=='Work')throw Error('Invalid application area.');
   if(![row.payload.title,app.employer,app.role].some(label=>careerFold(label).includes(term)))continue;
   stages.set(app.stage,(stages.get(app.stage)??0)+1);
   if(!stage||app.stage===stage)matches.push(row);
  }
  if(offset&&offset>=matches.length)throw Error('Applications changed. Refresh the first page.');
  matches.sort((a,b)=>a.application.stage.localeCompare(b.application.stage)||a.application.employer.localeCompare(b.application.employer)||
   a.application.role.localeCompare(b.application.role)||a.id.localeCompare(b.id));
  const applications=matches.slice(offset,offset+50).map(row=>{
   const projectToken=token();s.actions.set(projectToken,row);
   return {projectToken,title:row.payload.title,...row.application};
  });
  return {viewId:s.viewId,expiresAt:s.expiresAt,query,stage,offset,applications,total:matches.length,
   stages:[...stages].sort(([a],[b])=>a.localeCompare(b)).map(([label,count])=>({label,count}))};
 }
 async function profile(contextId,actor,expiresAt,values){
  const {query,offset}=goalFilters(values),s=begin(contextId,actor.ownerId,expiresAt);
  const rows=await api.listPrivateProjects(actor.accessToken,actor.ownerId,{careerGoals:true});
  if(!alive(s)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Career goals changed.');
  const term=careerFold(query),matches=[];
  for(const raw of rows){
   const row=privateProjectState(raw,actor.ownerId,{summary:true}),goal=goalSummary(row.goal);
   if(row.section!=='Work')throw Error('Invalid career goal area.');
   if([row.payload.title,goal.role,...goal.skills,...goal.certifications].some(label=>careerFold(label).includes(term)))matches.push(row);
  }
  if(offset&&offset>=matches.length)throw Error('Goals changed. Refresh the first page.');
  matches.sort((a,b)=>a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));
  const goals=matches.slice(offset,offset+50).map(row=>{
   const projectToken=token();s.actions.set(projectToken,row);
   return {projectToken,title:row.payload.title,status:row.payload.status,...row.goal};
  });
  return {viewId:s.viewId,expiresAt:s.expiresAt,query,offset,total:matches.length,goals};
 }
 function openRecord(contextId,actor,record,expiresAt){const s=begin(contextId,actor?.ownerId,expiresAt);try{if(typeof actor?.accessToken!=='string'||!actor.accessToken)throw Error('Active project session required.');const row=privateProjectState(record,actor.ownerId),projectToken=token();s.actions.set(projectToken,row);return{...view(row),projectToken,expiresAt:s.expiresAt};}catch(error){if(contexts.get(contextId)===s)clear(contextId);throw error;}}
 async function read(contextId,actor,projectToken){const s=state(contextId,actor),selected=s.actions.get(projectToken);if(!selected)throw Error('Select a displayed project.');s.review=null;s.receipts=null;s.mail=null;s.notes=null;const generation=++s.generation,row=await get(actor,selected.id);if(!alive(s)||s.generation!==generation||row.version!==selected.version)throw Error('Project changed. Fetch latest.');return{...view(row),projectToken,expiresAt:s.expiresAt};}
 async function receiptTarget(s,actor,projectToken){
  if(projectToken===null)return null;
  const selected=s.actions.get(projectToken);
  if(!selected)throw Error('Reopen the maintenance profile.');
  const record=await get(actor,selected.id);
  if(record.version!==selected.version||!alive(s))throw Error('Maintenance profile changed.');
  return record;
 }
 async function receipts(contextId,actor,projectToken,offset){
  if(!documentStorage)throw Error('Document Library unavailable.');
  const s=state(contextId,actor),generation=++s.generation;s.review=null;s.receipts=null;
  const row=await receiptTarget(s,actor,projectToken);
  const link=row?.payload.homeAsset?.receiptFile;
  const page=await receiptChoices(documentStorage,actor,offset);
  const doc=link?await documentStorage.inspect(actor,link.documentId):null;
  if(!alive(s)||s.generation!==generation)throw Error('Reopen the maintenance profile.');
  s.receipts={projectToken,options:page.options};
  return {...page.reply,attachedName:doc?.fields.name??null,expiresAt:s.expiresAt};
 }
 async function receiptDownload(contextId,actor,projectToken){
  const s=state(contextId,actor),generation=s.generation;
  if(!documentStorage||s.receipts?.projectToken!==projectToken)throw Error('Open the receipt picker first.');
  const record=await receiptTarget(s,actor,projectToken);
  const result=await downloadReceipt(documentStorage,actor,record?.payload.homeAsset?.receiptFile);
  const latest=await get(actor,record.id);
  if(!alive(s)||s.generation!==generation||!same(latest,record))throw Error('Maintenance profile changed.');
  return result;
 }
 async function workOriginal(s,actor,key){
  const selected=s.actions.get(key);
  if(!selected)throw Error('Select the original Work project.');
  const row=await get(actor,selected.id);
  if(!alive(s)||row.version!==selected.version||row.section!=='Work')throw Error('Work project changed.');
  return row;
 }
 async function noteOptions(contextId,actor,values){
  if(!readLinkedNote)throw Error('Note access unavailable.');
  const s=state(contextId,actor),n=++s.generation; s.review=null;s.notes=null;
  const source=await workOriginal(s,actor,values.projectToken),page=await noteChoices(api,actor,source,values);
  if(!alive(s)||n!==s.generation)throw Error('Note choices expired.');
  s.notes={options:page.options,key:values.projectToken};return {...page.reply,projectTitle:source.payload.title,expiresAt:s.expiresAt};
 }
 async function selectedNote(contextId,actor,values,forRead){
  const s=state(contextId,actor),n=++s.generation,item=s.notes?.options.get(values.choice);
  if(!readLinkedNote||!item||s.notes.key!==values.projectToken||forRead&&!item.linked)throw Error('Select a current project note.');
  s.review=null;
  const record=await workOriginal(s,actor,values.projectToken);
  await currentProjectNote(api,actor,record,item);
  if(!alive(s)||n!==s.generation)throw Error('Selected note changed.');
  if(forRead){
   const result=await readLinkedNote(contextId,actor,s.expiresAt,item);
   await workOriginal(s,actor,values.projectToken);
   if(!alive(s)||n!==s.generation)throw Error('Note link expired.');return result;
  }
  const proposed=proposedNoteLink(record,item,values.linked);
  const review={id:token(),s,record,proposed,item,linked:values.linked,claimed:false,started:false};
  s.review=review;
  return {reviewId:review.id,expiresAt:s.expiresAt,projectTitle:record.payload.title,noteTitle:item.title,linked:values.linked};
 }
 async function applicationOriginal(s,actor,key){
  const selected=s.actions.get(key);
  if(!allowSavedMail||!selected)throw Error('Open a saved Work application.');
  const row=await get(actor,selected.id);
  if(!alive(s)||row.version!==selected.version||row.section!=='Work'||row.payload.career?.kind!=='application')throw Error('Reopen the current application.');
  return row;
 }
 async function mailOptions(contextId,actor,projectToken,offset){
  const s=state(contextId,actor),generation=++s.generation;s.review=null;s.mail=null;
  const row=await applicationOriginal(s,actor,projectToken);
  const {matches,...paging}=await applicationMailPage(api,actor,row,offset,now(),s.expiresAt);
  if(!alive(s)||s.generation!==generation)throw Error('Reopen the current application.');
  const options=new Map(matches.map(item=>[token(),item]));
  s.mail={options,offset,projectToken};
  return {...paging,choices:[...options].map(([choice,item])=>({choice,...mailEvidence(item)})),expiresAt:s.expiresAt};
 }
 async function confirmMail(actor,record,source,s){
  const {matches}=await applicationMailPage(api,actor,record,source.offset,now(),s.expiresAt);
  if(!alive(s)||!matches.some(item=>stableStringify(item)===stableStringify(source.item)))throw Error('The saved email changed. Check the current page again.');
 }
 async function reviewMail(contextId,actor,projectToken,choice){
  const s=state(contextId,actor),generation=++s.generation,picker=s.mail;
  s.review=null;s.mail=null;
  const item=picker?.options.get(choice);
  if(!item||picker.projectToken!==projectToken)throw Error('Choose a current saved email suggestion.');
  const record=await applicationOriginal(s,actor,projectToken),source={item,offset:picker.offset};
  await confirmMail(actor,record,source,s);
  if(s.generation!==generation)throw Error('Reopen the current application.');
  const fields=view(record),before=fields.career.stage;
  fields.career={...fields.career,stage:item.stage};
  const result=await prepare(contextId,actor,{action:'edit',projectToken,fields});
  if(!alive(s)||!s.review||s.review.id!==result.reviewId)throw Error('Suggestion review expired.');
  s.review.mailSource=source;
  return {...result,stageSource:{before,...mailEvidence(item)}};
 }
 async function prepare(contextId,actor,values){const s=state(contextId,actor);s.review=null;const generation=++s.generation;if(!values||!['create','edit'].includes(values.action)||Object.keys(values).some(k=>!['action','fields','projectToken',...(documentStorage?['receiptChoice']:[])].includes(k))||values.action==='create'&&values.projectToken!==undefined)throw Error('Exact project action required.');const fields=projectFields(values.fields);let record=null;if(values.action==='edit'){const selected=s.actions.get(values.projectToken);if(!selected)throw Error('Select a displayed project.');record=await get(actor,selected.id);if(!alive(s)||s.generation!==generation||record.version!==selected.version)throw Error('Project changed. Fetch latest.');}
  if(record?.payload.noteIds&&fields.section!=='Work')throw Error('Unlink the project notes before moving this project out of Work.');
  const original=record?.payload.homeAsset?.receiptFile??null;
  const inputLink=fields.homeAsset?.receiptFile??null;
  if(stableStringify(original)!==stableStringify(inputLink))throw Error('Use the receipt picker before changing or removing a linked file.');
  let receiptName,reviewedDocument;
  if(Object.hasOwn(values,'receiptChoice')){
   if(!fields.homeAsset||!s.receipts||s.receipts.projectToken!==(values.projectToken??null))throw Error('Choose a maintenance receipt in the current profile.');
   const chosen=selectedReceipt(s.receipts,values.receiptChoice,original);
   if(chosen.file){
    const current=await documentStorage.inspect(actor,chosen.file.documentId),selected=s.receipts.options.get(values.receiptChoice);
    if(!alive(s)||s.generation!==generation||current.version!==selected.version)throw Error('Reopen the changed receipt.');
    reviewedDocument=current;fields.homeAsset.receiptFile=chosen.file;
   }else delete fields.homeAsset.receiptFile;
   receiptName=chosen.name;
  }
  if(record&&stableStringify(view(record))===stableStringify(fields))return{noChanges:true};
  const id=record?.id??idFactory();if(!uuid(id))throw Error('Server project identity required.');const proposed={id,owner_id:actor.ownerId,household_id:null,visibility:'private',section:fields.section,item_type:'project',origin:PROJECT_ORIGIN,payload:{fictional:true,schemaVersion:1,title:fields.title,description:fields.description,status:fields.status,...(Object.hasOwn(fields,'separateRecurring')?{separateRecurring:fields.separateRecurring}:{}),...(fields.career?{career:fields.career}:{}),...(fields.homeAsset?{homeAsset:fields.homeAsset}:{}),...(record?.payload.noteIds?{noteIds:record.payload.noteIds}:{})}},review={id:token(),s,record,proposed,reviewedDocument,started:false,claimed:false};if(!alive(s))throw Error('Project review expired.');s.review=review;return{reviewId:review.id,action:record?'edit':'create',...fields,...(receiptName===undefined?{}:{receiptName}),expiresAt:s.expiresAt};}
 function claim(contextId,owner,reviewId){const s=state(contextId,{ownerId:owner}),r=s.review;if(!r||r.id!==reviewId)throw Error('Project review ended.');s.review=null;s.actions.clear();s.generation++;r.claimed=true;return r;}
 async function authorize(r,actor){if(!r?.claimed||!alive(r.s)||r.s.ownerId!==actor.ownerId)return false;if(r.item)await currentProjectNote(api,actor,r.record,r.item);if(r.mailSource)await confirmMail(actor,r.record,r.mailSource,r.s);if(r.reviewedDocument){const current=await documentStorage.inspect(actor,r.reviewedDocument.id);if(current.version!==r.reviewedDocument.version||!alive(r.s))return false;}if(!r.record)return true;return same(await get(actor,r.record.id),r.record)&&alive(r.s);}
 async function save(r,actor){if(!r?.claimed||r.started||!alive(r.s)||r.s.ownerId!==actor.ownerId)throw Error('Project review ended.');r.started=true;
  if(r.item){
   const row=await api.setWorkProjectNote(actor.accessToken,{projectId:r.record.id,projectVersion:r.record.version,noteId:r.item.id,noteVersion:r.item.version,linked:r.linked});
   const confirmed=privateProjectState(row,actor.ownerId);
   if(confirmed.id!==r.record.id||confirmed.version!==r.record.version+1||stableStringify(confirmed.payload)!==stableStringify(r.proposed.payload)||
      !same(await get(actor,confirmed.id),confirmed)||!alive(r.s))throw Error('Note link save unconfirmed.');
   return {saved:true,project:openRecord(r.s.contextId,actor,confirmed,r.s.expiresAt)};
  }
  const rows=await(r.record?api.updatePrivateProject(actor.accessToken,r.record,actor.ownerId,r.proposed):api.addPrivateProject(actor.accessToken,structuredClone(r.proposed)));if(!Array.isArray(rows)||rows.length!==1)throw Error('Project save unconfirmed; check latest before retrying.');const ack=privateProjectState(rows[0],actor.ownerId),p=r.proposed;if(ack.id!==p.id||ack.section!==p.section||stableStringify(ack.payload)!==stableStringify(p.payload)||r.record&&ack.version!==r.record.version+1||!r.record&&ack.version!==1)throw Error('Project save acknowledgement unavailable.');const latest=await get(actor,p.id);if(!same(latest,ack)||!alive(r.s))throw Error('Project save changed during verification. Check latest.');clear(r.s.contextId);return{saved:true};}
 function advanceHierarchyVersions(contextId,actor,changed){
  const s=state(contextId,actor);if(!Array.isArray(changed)||changed.length!==2||changed[0].id===changed[1].id)throw Error('Verified hierarchy endpoints required.');
  for(const record of s.actions.values()){const endpoint=changed.find(row=>row.id===record.id);if(endpoint&&record.version!==endpoint.version)throw Error('Project selection changed during relationship save.');}
  for(const record of s.actions.values())if(changed.some(row=>row.id===record.id))record.version++;
 }
 async function colorRecord(id,actor,token){
  const context=state(id,actor),selected=context.actions.get(token);
  if(!selected)throw Error('Select a displayed project.');
  const record=await get(actor,selected.id);
  if(!alive(context)||record.id!==selected.id||record.version!==selected.version||record.section!==selected.section||record.payload.title!==selected.payload.title||record.payload.status!==selected.payload.status)throw Error('Project changed. Fetch latest.');
  return {record,expiresAt:context.expiresAt};
 }
 return{list,pipeline,profile,read,colorRecord,noteOptions,selectedNote,mailOptions,reviewMail,receipts,receiptDownload,openRecord,prepare,claim,authorize,save,clear,advanceHierarchyVersions,selected:(id,actor,key)=>{const s=state(id,actor),row=s.actions.get(key);if(!row)throw Error('Select a displayed project.');return structuredClone(row);},hasAction:(id,key)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).actions.has(key)),current:(id,key)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).review?.id===key),currentView:(id,viewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===viewId),dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
