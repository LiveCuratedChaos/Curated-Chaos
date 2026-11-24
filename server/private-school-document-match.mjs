import {randomBytes} from 'node:crypto';
import {schoolGuideVersions} from '../src/private-school-guides.mjs';
import {stableStringify} from './stable-json.mjs';
import {writeReviewedSchoolGuide} from './private-school-library.mjs';

const fold=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
const headingKinds=new Map([['syllabus','syllabus'],['course syllabus','syllabus'],['course guide','course'],['program guide','program']]);
export function schoolDocumentEvidence(parsed){
 if(parsed.status!=='ready'||!parsed.pages.length||parsed.methods.some(m=>m==='unavailable'))return null;
 const types=new Set(),subjects=new Set(),options=new Map();
 parsed.pages.forEach((page,i)=>{
  const lines=page.split(/\r\n|[\r\n\u2028\u2029]/).map(v=>v.trim()),heads=[],anchors=[];
  for(const line of lines){
   const kind=headingKinds.get(fold(line));
   if(kind){heads.push({kind,heading:line});types.add(kind);}
   const match=line.match(/^(course code|program|degree program)\s*:\s*(\S.*)$/i);
   if(match&&line.length<=180){
    const type=fold(match[1])==='course code'?'course':'degree',subject=fold(match[2]);
    subjects.add(type+'/'+subject);anchors.push({type,subject,quote:line});
   }
  }
  for(const h of heads)for(const a of anchors){
   if((a.type==='degree')!==(h.kind==='program'))continue;
   const key=h.kind+'/'+a.type+'/'+a.subject;
   if(!options.has(key))options.set(key,{...h,...a,page:i+1,method:parsed.methods[i]});
  }
 });
 if(types.size!==1||options.size!==1)return null;
 const evidence=options.values().next().value;
 // A course syllabus can also name its program. Two different course codes are ambiguous.
 if([...subjects].filter(s=>s.startsWith(evidence.type+'/')).length!==1)return null;
 return evidence;
}
const fail=()=>{throw Error('Reopen the selected file and its School link.');};
export function createSchoolDocumentMatch({api,reader,documents,now}){
 async function match(c,actor,docChoice,current){
  const {doc,parsed}=await documents.selectedText(c.id,actor,docChoice);
  const evidence=schoolDocumentEvidence(parsed);
  if(!evidence)return {status:'noMatch'};
  const overview=await reader.overview(c.id,actor,c.expiresAt);
  if(!current())fail();
  const candidates=evidence.type==='degree'?overview.programs.filter(p=>fold(p.title)===evidence.subject):overview.courses.filter(r=>fold(r.code)===evidence.subject);
  if(candidates.length!==1)return {status:candidates.length?'ambiguous':'noMatch'};
  const selected=candidates[0],row=await reader.selectedRecord(c.id,actor,selected.schoolReadToken);
  if(!current())fail();
  const versions=schoolGuideVersions(row.payload).filter(g=>g.kind===evidence.kind);
  if(versions.some(g=>g.documentId===doc.id))return {status:'linked'};
  if(schoolGuideVersions(row.payload).length>=50)return {status:'full'};
  const publicFields={name:doc.fields.name,title:row.payload.title,program:evidence.type==='course'?selected.programTitle:'',
   kind:evidence.kind,number:versions.length+1,method:evidence.method,page:evidence.page,heading:evidence.heading,quote:evidence.quote};
  return {status:'ready',doc,row,publicFields};
 }
 async function preview(c,actor,docChoice,current){
  const result=await match(c,actor,docChoice,current);
  if(!current())fail();
  if(result.status!=='ready')return {status:result.status};
  const id=randomBytes(32).toString('base64url');
  c.schoolDocumentMatch={id,owner:actor.ownerId,docChoice,doc:result.doc,recordId:result.row.id,version:result.row.version,
   expiresAt:Math.min(c.expiresAt,now()+300000),publicFields:result.publicFields};
  return {status:'ready',reviewId:id,...result.publicFields};
 }
 async function save(c,actor,claim,current){
  const result=await match(c,actor,claim.docChoice,current);
  if(result.status!=='ready'||!current()||claim.owner!==actor.ownerId||claim.expiresAt<=now()||
    result.row.id!==claim.recordId||result.row.version!==claim.version||stableStringify(result.doc)!==stableStringify(claim.doc)||
    stableStringify(result.publicFields)!==stableStringify(claim.publicFields))fail();
  const guide={kind:claim.publicFields.kind,documentId:claim.doc.id,addedAt:new Date(now()).toISOString()};
  await writeReviewedSchoolGuide({api,actor,row:result.row,doc:claim.doc,guide,current});
  return {saved:true};
 }
 return {preview,save};
}
