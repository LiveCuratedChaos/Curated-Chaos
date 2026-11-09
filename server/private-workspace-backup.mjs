// Private cc_records archive only. No credentials files, shared records, database writes or restore.
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {open,mkdir,lstat,realpath,unlink} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve,dirname,join} from 'node:path';
import {stableStringify} from './stable-json.mjs';import {safeSavedAt} from './snapshot-freshness.mjs';
const MAX_PLAINTEXT=5*1024*1024,MAX_FILE=8*1024*1024,uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function onlyKeys(object,allowed){return object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).every(key=>allowed.includes(key));}
export function validatePrivateWorkspaceRows(rows,ownerId,key){
 if(!uuid(ownerId)||!Array.isArray(rows)||rows.length>2000||!Buffer.isBuffer(key)||key.length!==32)throw Error('Bounded private workspace and existing key required.');
 const seen=new Set();return rows.map(row=>{
  if(!onlyKeys(row,['id','owner_id','household_id','visibility','section','item_type','origin','payload','version','deleted_at','created_at','updated_at'])||!uuid(row.id)||seen.has(row.id)||row.owner_id!==ownerId||row.visibility!=='private'||row.household_id!==null||!['Home','Calendar','Personal Life','Work','School','Finances'].includes(row.section)||typeof row.item_type!=='string'||row.item_type.length<1||row.item_type.length>60||typeof row.origin!=='string'||!row.origin.length||row.origin.length>500||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||!Number.isInteger(row.version)||row.version<1)throw Error('Unexpected private workspace scope.');
  if(!safeSavedAt(row.created_at)||!safeSavedAt(row.updated_at)||row.deleted_at!=null&&!safeSavedAt(row.deleted_at))throw Error('Unverified workspace timestamps.');seen.add(row.id);
  const copy=JSON.parse(JSON.stringify(row));if(Buffer.byteLength(JSON.stringify(copy.payload))>1024*1024)throw Error('Workspace record exceeds its size cap.');return copy;
 });
}
export function sealPrivateWorkspace({projectRef,ownerId,rows,key,now=Date.now(),snapshotId=randomUUID()}){
 if(typeof projectRef!=='string'||!/^[a-z0-9]{10,32}$/.test(projectRef)||!uuid(snapshotId)||!Number.isFinite(now))throw Error('Verified development snapshot identity required.');const records=validatePrivateWorkspaceRows(rows,ownerId,key),snapshot={kind:'curated-private-workspace-v1',snapshotId,projectRef,ownerId,createdAt:new Date(now).toISOString(),records};
 const plaintext=Buffer.from(JSON.stringify(snapshot));if(plaintext.length>MAX_PLAINTEXT)throw Error('Private workspace backup exceeds its size cap.');
 try{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('curated-private-workspace-v1'));const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);return{bytes:Buffer.from(JSON.stringify({v:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:ciphertext.toString('base64url')})),snapshot};}finally{plaintext.fill(0);}
}
export function inspectPrivateWorkspace(bytes,{key,projectRef,ownerId}){
 try{
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_FILE||!Buffer.isBuffer(key)||key.length!==32)throw Error();const p=JSON.parse(bytes.toString('utf8'));if(!onlyKeys(p,['v','iv','tag','data'])||p.v!==1||![p.iv,p.tag,p.data].every(value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)))throw Error();
  const iv=Buffer.from(p.iv,'base64url'),tag=Buffer.from(p.tag,'base64url'),data=Buffer.from(p.data,'base64url');if(iv.length!==12||tag.length!==16||data.length>MAX_PLAINTEXT)throw Error();const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('curated-private-workspace-v1'));decipher.setAuthTag(tag);const plaintext=Buffer.concat([decipher.update(data),decipher.final()]);
  try{const snapshot=JSON.parse(plaintext.toString('utf8'));if(!onlyKeys(snapshot,['kind','snapshotId','projectRef','ownerId','createdAt','records'])||snapshot.kind!=='curated-private-workspace-v1'||!uuid(snapshot.snapshotId)||snapshot.projectRef!==projectRef||snapshot.ownerId!==ownerId||!safeSavedAt(snapshot.createdAt))throw Error();snapshot.records=validatePrivateWorkspaceRows(snapshot.records,ownerId,key);return snapshot;}finally{plaintext.fill(0);}
 }catch{throw Error('Private workspace backup could not be authenticated for this owner, project and key. No restore attempted.');}
}
export async function writePrivateWorkspace({directory,...args}){
 const target=resolve(directory),parent=dirname(target),parentStat=await lstat(parent);if(!parentStat.isDirectory()||parentStat.isSymbolicLink()||parentStat.uid!==process.getuid()||(parentStat.mode&0o077)||await realpath(parent)!==parent)throw Error('Existing owner-private canonical backup parent required.');
 const sealed=sealPrivateWorkspace(args);try{await mkdir(target,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}const dirStat=await lstat(target);if(!dirStat.isDirectory()||dirStat.isSymbolicLink()||dirStat.uid!==process.getuid()||(dirStat.mode&0o077)||await realpath(target)!==target)throw Error('Private backup directory required.');
 const path=join(target,sealed.snapshot.snapshotId+'.ccworkspace');let identity;
 try{const output=await open(path,'wx',0o600);try{identity=await output.stat();await output.writeFile(sealed.bytes);await output.sync();}finally{await output.close();}
  const input=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let stored;try{const stat=await input.stat();if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600||stat.size>MAX_FILE||stat.ino!==identity.ino||stat.dev!==identity.dev)throw Error('Private backup verification failed.');stored=await input.readFile();}finally{await input.close();}
  const reread=inspectPrivateWorkspace(stored,args);if(stableStringify(reread)!==stableStringify(sealed.snapshot))throw Error('Backup reread did not match.');return{path,snapshotId:reread.snapshotId,recordCount:reread.records.length,encrypted:true,verified:true,databaseWritten:false};
 }catch(error){if(identity){try{const stat=await lstat(path);if(stat.ino===identity.ino&&stat.dev===identity.dev)await unlink(path);}catch{}}throw error;}
}
