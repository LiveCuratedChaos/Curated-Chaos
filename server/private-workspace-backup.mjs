import {projectNoteIds} from '../src/private-project-note-fields.mjs';
import {verifyArchivedDocuments,verifyArchivedReceiptLinks,MAX_WORKSPACE_FILE} from './private-document-archive.mjs';
import {verifyRecordVersionRecovery} from './private-record-version-provenance.mjs';
import {validateCommonTaskMembershipHistory} from './private-common-task-history.mjs';
import {validateProjectHierarchy} from '../src/project-hierarchy.mjs';
import {projectMembershipState} from './private-project-task-links.mjs';
// Private cc_records archive only. No credentials files, shared records, database writes or restore.
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {open,mkdir,lstat,realpath,unlink} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve,dirname,join} from 'node:path';
import {stableStringify} from './stable-json.mjs';import {safeSavedAt} from './snapshot-freshness.mjs';
const MAX_PLAINTEXT=5*1024*1024,MAX_FILE=8*1024*1024,MAX_DOCUMENT_PLAINTEXT=29*1024*1024,uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function onlyKeys(object,allowed){return object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).every(key=>allowed.includes(key));}
export function validatePrivateWorkspaceRows(rows,ownerId,key){
 if(!uuid(ownerId)||!Array.isArray(rows)||rows.length>2000||!Buffer.isBuffer(key)||key.length!==32)throw Error('Bounded private workspace and existing key required.');
 const seen=new Set();const result=rows.map(row=>{
  if(!onlyKeys(row,['id','owner_id','household_id','visibility','section','item_type','origin','payload','version','deleted_at','created_at','updated_at'])||!uuid(row.id)||seen.has(row.id.toLowerCase())||row.owner_id!==ownerId||row.visibility!=='private'||row.household_id!==null||!['Home','Calendar','Personal Life','Work','School','Finances'].includes(row.section)||typeof row.item_type!=='string'||row.item_type.length<1||row.item_type.length>60||typeof row.origin!=='string'||!row.origin.length||row.origin.length>500||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||!Number.isInteger(row.version)||row.version<1)throw Error('Unexpected private workspace scope.');
  if(!safeSavedAt(row.created_at)||!safeSavedAt(row.updated_at)||row.deleted_at!=null&&!safeSavedAt(row.deleted_at))throw Error('Unverified workspace timestamps.');seen.add(row.id.toLowerCase());
  const copy=JSON.parse(JSON.stringify(row));if(Buffer.byteLength(JSON.stringify(copy.payload))>1024*1024)throw Error('Workspace record exceeds its size cap.');return copy;
 });
 validateCommonTaskMembershipHistory(result,ownerId);
 const byId=new Map(result.map(r=>[r.id,r])),pairs=new Set();for(const row of result){if(row.item_type!=='project_task_link')continue;projectMembershipState(row,ownerId);const task=byId.get(row.payload.taskId),project=byId.get(row.payload.projectId),pair=row.payload.taskId+':'+row.payload.projectId;if(pairs.has(pair)||!task||task.item_type!=='task'||!project||project.item_type!=='project'||project.origin!=='PRIVATE_COOKIE_PROJECT'||row.deleted_at===null&&(task.deleted_at!==null||project.deleted_at!==null))throw Error('Project membership backup requires its exact private targets without duplicate pairs.');pairs.add(pair);}
 for(const row of result.filter(r=>r.item_type==='project'&&Object.hasOwn(r.payload,'noteIds'))){
  if(row.origin!=='PRIVATE_COOKIE_PROJECT'||row.payload.fictional!==true||row.payload.schemaVersion!==1)throw Error('Unsupported Work project notes.');
  for(const id of projectNoteIds(row)){
   const note=byId.get(id);if(!note||note.item_type!=='note'||note.section!=='Personal Life'||note.deleted_at!==null||note.payload?.fictional!==true||
    typeof note.payload.title!=='string'||!note.payload.title.trim()||typeof note.payload.body!=='string')throw Error('Work project backup requires the original private notes.');
  }
 }
 const relationships=result.filter(r=>r.item_type==='project_project_link');if(relationships.length){for(const r of relationships){const parent=byId.get(r.payload.parentProjectId),child=byId.get(r.payload.childProjectId);if(!parent||!child||parent.item_type!=='project'||child.item_type!=='project'||parent.origin!=='PRIVATE_COOKIE_PROJECT'||child.origin!=='PRIVATE_COOKIE_PROJECT')throw Error('Hierarchy backup requires exact private targets.');}validateProjectHierarchy({ownerId,projects:result.filter(r=>r.item_type==='project'&&r.deleted_at===null),relationships});}return result;
}
// Optional additive history inventory; older archives remain byte-contract compatible.
export function validatePrivateRecordVersions(versions,records,ownerId,key){
 if(!Array.isArray(versions)||versions.length>20000)throw Error('Bounded private record history required.');
 const sources=new Map(records.map(row=>[row.id.toLowerCase(),row])),seen=new Set();
 return versions.map(entry=>{
  if(!onlyKeys(entry,['id','owner_id','record_id','source_version','item_type','operation','captured_at','snapshot','recovery'])||Object.keys(entry).length!==(Object.hasOwn(entry,'recovery')?9:8)||!uuid(entry.id)||seen.has(entry.id.toLowerCase())||entry.owner_id!==ownerId||!uuid(entry.record_id)||!Number.isInteger(entry.source_version)||entry.source_version<1||!['task','note','event','project','school_fixture','dashboard_layout','list_template'].includes(entry.item_type)||!['UPDATE','DELETE'].includes(entry.operation)||!safeSavedAt(entry.captured_at))throw Error('Unverified private record history.');
  verifyRecordVersionRecovery(entry.recovery??null);if(Object.hasOwn(entry,'recovery')&&entry.recovery===undefined)throw Error('Explicit recovery provenance required.');
  const source=sources.get(entry.record_id.toLowerCase());
  if(!source||source.item_type!==entry.item_type)throw Error('History requires its exact owned private source.');
  const snapshot=validatePrivateWorkspaceRows([entry.snapshot],ownerId,key)[0];
  if(snapshot.id.toLowerCase()!==entry.record_id.toLowerCase()||snapshot.item_type!==entry.item_type||snapshot.version!==entry.source_version)throw Error('History source identity or revision differs.');
  seen.add(entry.id.toLowerCase());return JSON.parse(JSON.stringify({...entry,snapshot}));
 });
}
export function sealPrivateWorkspace({projectRef,ownerId,rows,recordVersions,documents,key,now=Date.now(),snapshotId=randomUUID()}){
 if(typeof projectRef!=='string'||!/^[a-z0-9]{10,32}$/.test(projectRef)||!uuid(snapshotId)||!Number.isFinite(now))throw Error('Verified development snapshot identity required.');const records=validatePrivateWorkspaceRows(rows,ownerId,key),snapshot={kind:'curated-private-workspace-v1',snapshotId,projectRef,ownerId,createdAt:new Date(now).toISOString(),records,...(recordVersions===undefined?{}:{recordVersions:validatePrivateRecordVersions(recordVersions,records,ownerId,key)})};
 if(Buffer.byteLength(JSON.stringify(snapshot))>MAX_PLAINTEXT)throw Error('Private workspace backup exceeds its size cap.');
 const version=documents===undefined?1:2;
 if(version===2){snapshot.kind='curated-private-workspace-v2';snapshot.documents=verifyArchivedDocuments(documents,ownerId,key);verifyArchivedReceiptLinks([...records,...(snapshot.recordVersions??[]).map(v=>v.snapshot)],documents,ownerId,key);}
 const plaintext=Buffer.from(JSON.stringify(snapshot));if(plaintext.length>(version===2?MAX_DOCUMENT_PLAINTEXT:MAX_PLAINTEXT))throw Error('Private workspace backup exceeds its size cap.');
 try{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(snapshot.kind));const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);return{bytes:Buffer.from(JSON.stringify({v:version,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:ciphertext.toString('base64url')})),snapshot};}finally{plaintext.fill(0);}
}
export function inspectPrivateWorkspace(bytes,{key,projectRef,ownerId}){
 try{
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_WORKSPACE_FILE||!Buffer.isBuffer(key)||key.length!==32)throw Error();const p=JSON.parse(bytes.toString('utf8'));if(!onlyKeys(p,['v','iv','tag','data'])||![1,2].includes(p.v)||p.v===1&&bytes.length>MAX_FILE||![p.iv,p.tag,p.data].every(value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)))throw Error();
  const iv=Buffer.from(p.iv,'base64url'),tag=Buffer.from(p.tag,'base64url'),data=Buffer.from(p.data,'base64url');if(iv.length!==12||tag.length!==16||data.length>(p.v===1?MAX_PLAINTEXT:MAX_DOCUMENT_PLAINTEXT))throw Error();const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('curated-private-workspace-v'+p.v));decipher.setAuthTag(tag);const plaintext=Buffer.concat([decipher.update(data),decipher.final()]);
  try{const snapshot=JSON.parse(plaintext.toString('utf8'));if(!onlyKeys(snapshot,['kind','snapshotId','projectRef','ownerId','createdAt','records','recordVersions',...(p.v===2?['documents']:[])])||snapshot.kind!=='curated-private-workspace-v'+p.v||!uuid(snapshot.snapshotId)||snapshot.projectRef!==projectRef||snapshot.ownerId!==ownerId||!safeSavedAt(snapshot.createdAt))throw Error();if(p.v===2){verifyArchivedDocuments(snapshot.documents,ownerId,key);verifyArchivedReceiptLinks([...snapshot.records,...(snapshot.recordVersions??[]).map(v=>v.snapshot)],snapshot.documents,ownerId,key);const {documents,...ordinary}=snapshot;if(Buffer.byteLength(JSON.stringify(ordinary))>MAX_PLAINTEXT)throw Error();}
   snapshot.records=validatePrivateWorkspaceRows(snapshot.records,ownerId,key);if(Object.hasOwn(snapshot,'recordVersions'))snapshot.recordVersions=validatePrivateRecordVersions(snapshot.recordVersions,snapshot.records,ownerId,key);return snapshot;}finally{plaintext.fill(0);}
 }catch{throw Error('Private workspace backup could not be authenticated for this owner, project and key. No restore attempted.');}
}
export async function writePrivateWorkspace({directory,...args}){
 const target=resolve(directory),parent=dirname(target),parentStat=await lstat(parent);if(!parentStat.isDirectory()||parentStat.isSymbolicLink()||parentStat.uid!==process.getuid()||(parentStat.mode&0o077)||await realpath(parent)!==parent)throw Error('Existing owner-private canonical backup parent required.');
 const sealed=sealPrivateWorkspace(args);try{await mkdir(target,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}const dirStat=await lstat(target);if(!dirStat.isDirectory()||dirStat.isSymbolicLink()||dirStat.uid!==process.getuid()||(dirStat.mode&0o077)||await realpath(target)!==target)throw Error('Private backup directory required.');
 const path=join(target,sealed.snapshot.snapshotId+'.ccworkspace');let identity;
 try{const output=await open(path,'wx',0o600);try{identity=await output.stat();await output.writeFile(sealed.bytes);await output.sync();}finally{await output.close();}
  const input=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let stored;try{const stat=await input.stat();if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600||stat.size>MAX_WORKSPACE_FILE||stat.ino!==identity.ino||stat.dev!==identity.dev)throw Error('Private backup verification failed.');stored=await input.readFile();}finally{await input.close();}
  const reread=inspectPrivateWorkspace(stored,args);if(stableStringify(reread)!==stableStringify(sealed.snapshot))throw Error('Backup reread did not match.');return{path,snapshotId:reread.snapshotId,recordCount:reread.records.length,...(reread.documents?{documentCount:reread.documents.length}:{}),...(Object.hasOwn(reread,'recordVersions')?{recordVersionCount:reread.recordVersions.length}:{}),encrypted:true,verified:true,databaseWritten:false};
 }catch(error){if(identity){try{const stat=await lstat(path);if(stat.ino===identity.ino&&stat.dev===identity.dev)await unlink(path);}catch{}}throw error;}
}
