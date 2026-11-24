import {extractDocumentPages} from './private-document-extraction.mjs';
import {schoolGuideChanges,proposeGuideChanges} from '../src/private-school-guide-changes.mjs';
import {randomBytes} from 'node:crypto';
import {receiptChoices} from './private-receipt-files.mjs';
import {schoolGuideVersions,schoolGuideKinds} from '../src/private-school-guides.mjs';
import {stableStringify} from './stable-json.mjs';

const opaque=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>stableStringify(a)===stableStringify(b);
const fail=()=>{throw Error('Reopen the selected School Library.');};

async function confirmSchoolWrite(api,actor,row,expected,ack,current){
 const [saved]=await api.getPrivateSchoolRecord(actor.accessToken,row.id,actor.ownerId);
 if(!current()||!Array.isArray(ack)||ack.length!==1||
   ![ack[0],saved].every(r=>r?.owner_id===actor.ownerId&&r.id===row.id&&r.version===row.version+1&&equal(r.payload,expected)))fail();
 return {saved:true};
}
export async function writeReviewedSchoolGuide({api,actor,row,doc,guide,current}){
 const expected={...row.payload,guideDocuments:[...schoolGuideVersions(row.payload),guide]};
 schoolGuideVersions(expected);
 if(!current())fail();
 const ack=await api.appendPrivateSchoolGuide(actor.accessToken,row.id,row.version,doc.version,guide);
 return confirmSchoolWrite(api,actor,row,expected,ack,current);
}

export function createSchoolLibrary({api,reader,storage,now}){
 async function open(c,actor,schoolReadToken,offset,editable,current){
  const record=await reader.selectedRecord(c.id,actor,schoolReadToken);
  const guides=schoolGuideVersions(record.payload),versions=new Map(),counts=new Map();
  const expiresAt=Math.min(c.expiresAt,now()+300000);
  const details=new Map();
  const history=await Promise.all(guides.map(async guide=>{
   const number=(counts.get(guide.kind)??0)+1;counts.set(guide.kind,number);
   const document=await storage.inspect(actor,guide.documentId);
   const choice=opaque();versions.set(choice,document);details.set(choice,{guide,number});
   return {choice,number,kind:guide.kind,name:document.fields.name,addedAt:guide.addedAt};
  }));
  const picker=editable?await receiptChoices(storage,actor,offset):{options:new Map(),reply:{files:[],offset:0,hasMore:false}};
  if(!current()||!reader.isCurrentToken(c.id,schoolReadToken))fail();
  const id=opaque();
  c.schoolLibrary={id,schoolReadToken,recordId:record.id,owner:actor.ownerId,revision:record.version,versions,details,options:picker.options,expiresAt};
  return {viewId:id,expiresAt,history,...picker.reply};
 }
 async function selected(c,actor,v,current){
  const view=c.schoolLibrary;
  if(!view||view.id!==v.viewId||view.owner!==actor.ownerId||view.expiresAt<=now())fail();
  const row=await reader.selectedRecord(c.id,actor,view.schoolReadToken);
  if(!current()||c.schoolLibrary!==view||row.id!==view.recordId||row.version!==view.revision)fail();
  return {row,view};
 }
 async function review(c,actor,v,current){
  const {row,view}=await selected(c,actor,v,current),doc=view.options.get(v.choice);
  const guides=schoolGuideVersions(row.payload);
  if(!doc||guides.length>=50||!schoolGuideKinds(row.payload.kind).includes(v.kind))fail();
  const guide={kind:v.kind,documentId:doc.id,addedAt:new Date(now()).toISOString()};
  schoolGuideVersions({...row.payload,guideDocuments:[...guides,guide]});
  if(!equal(await storage.inspect(actor,doc.id),doc)||!current()||view!==c.schoolLibrary)fail();
  const reviewId=opaque(),number=guides.filter(g=>g.kind===guide.kind).length+1;
  view.review={id:reviewId,guide,doc};
  return {reviewId,number,kind:guide.kind,title:row.payload.title,name:doc.fields.name};
 }
 async function download(c,actor,v,current){
  const {view}=await selected(c,actor,v,current),doc=view.versions.get(v.choice);
  if(!doc)fail();
  const result=await storage.read(actor,doc);
  if(!current()||view!==c.schoolLibrary||!reader.isCurrentToken(c.id,view.schoolReadToken))fail();
  return {fields:result.fields,data:result.data};
 }
 async function inspectPlan(c,actor,v,current){
  const {view,row}=await selected(c,actor,v,current),doc=view.versions.get(v.choice),detail=view.details.get(v.choice);
  if(!detail||!doc)fail();
  const {guide,number}=detail,all=schoolGuideChanges(row.payload);
  const publicChange=({field,before,after,page,anchor,quote})=>({field,before,after,page,anchor,quote});
  const applied=all.filter(g=>g.kind===guide.kind&&g.documentId===doc.id).map(publicChange);
  const reply={name:doc.fields.name,number,kind:guide.kind,applied,changes:[]};
  if(schoolGuideVersions(row.payload).filter(g=>g.kind===guide.kind).at(-1)?.documentId!==doc.id)return {...reply,status:'historical'};
  if(doc.fields.mime!=='application/pdf')return {...reply,status:'unreadable'};
  const original=await storage.read(actor,doc);
  if(!current()||c.schoolLibrary!==view)fail();
  const bytes=Buffer.from(original.data,'base64');
  let result;try{result=await extractDocumentPages(bytes);}finally{bytes.fill(0);}
  if(!current()||c.schoolLibrary!==view)fail();
  if(result.status!=='ready')return {...reply,status:result.status};
  if(result.pages.some(page=>!page.trim()))return {...reply,status:'unreadable'};
  await selected(c,actor,v,current);
  const proposals=new Map();
  for(const change of proposeGuideChanges(row.payload,guide,result.pages)){
   const choice=opaque();proposals.set(choice,{doc,change});
   reply.changes.push({choice,...publicChange(change)});
  }
  view.proposals=proposals;
  return {...reply,status:'ready'};
 }
 async function save(c,actor,v,claim,current){
  const {row,view}=await selected(c,actor,v,current);
  if(!equal(await storage.inspect(actor,claim.doc.id),claim.doc)||!current())fail();
  let expected,ack;
  if(claim.change){
   const change=claim.change;
   if(row.payload[change.field]!==change.before)fail();
   expected={...row.payload,[change.field]:change.after,guideChanges:[...schoolGuideChanges(row.payload),change]};
   schoolGuideChanges(expected);
   ack=await api.applyPrivateSchoolGuideChange(actor.accessToken,row.id,row.version,claim.doc.version,change);
  }else return writeReviewedSchoolGuide({api,actor,row,doc:claim.doc,guide:claim.guide,current:()=>current()&&c.schoolLibrary===view});
  return confirmSchoolWrite(api,actor,row,expected,ack,()=>current()&&c.schoolLibrary===view);
 }
 return {open,review,download,inspectPlan,save};
}
