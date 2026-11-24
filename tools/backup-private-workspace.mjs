// Default offline. One explicitly approved encrypted account-private record export only.
import {MAX_ARCHIVE_DOCUMENTS,MAX_DOCUMENT_ENVELOPES} from '../server/private-document-archive.mjs';
import {isDocumentId} from '../src/private-document-fields.mjs';
import {resolve,join} from 'node:path';import {homedir} from 'node:os';import {fileURLToPath} from 'node:url';
import {assertDevTarget,loadLocalConfig} from './dev-env.mjs';import {createDevApi} from '../src/dev-api.mjs';import {writePrivateWorkspace,validatePrivateWorkspaceRows,validatePrivateRecordVersions} from '../server/private-workspace-backup.mjs';import {stableStringify} from '../server/stable-json.mjs';import {readPrivatePreviewFile} from './preview-provider-restore.mjs';
export function validateWorkspaceBackupArguments(argv){if(!argv.includes('--allow-private-workspace-backup'))return null;const projects=argv.filter(arg=>arg.startsWith('--project='));const include=argv.includes('--include-documents');if(argv.length!==(include?3:2)||projects.length!==1||!/^[a-z0-9]{10,32}$/.test(projects[0].slice(10)))throw Error('Exact development project and private workspace backup approval required.');return{project:projects[0].slice(10),...(include?{includeDocuments:true}:{})};}
export async function readPrivateWorkspace({url,key,token,ownerId,fetcher=fetch}){
 const rows=[];let last=null;for(;;){const query=new URLSearchParams({select:'id,owner_id,household_id,visibility,section,item_type,origin,payload,version,deleted_at,created_at,updated_at',owner_id:'eq.'+ownerId,visibility:'eq.private',household_id:'is.null',order:'id.asc',limit:'100'});if(last)query.set('id','gt.'+last);
  const response=await fetcher(url+'/rest/v1/cc_records?'+query,{headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Workspace backup read failed.');const page=await response.json();if(!Array.isArray(page)||page.length>100||page.some((row,i)=>row.owner_id!==ownerId||row.visibility!=='private'||row.household_id!==null||typeof row.id!=='string'||row.id<=(i?page[i-1].id:last||'')))throw Error('Workspace page scope or order unverified.');rows.push(...page);if(rows.length>2000)throw Error('Workspace backup exceeds its record cap.');if(page.length<100)return rows;last=page.at(-1).id;
 }
}
// Missing prepared storage is distinct from failed or tampered installed storage.
export async function readPrivateWorkspaceVersions({url,key,token,ownerId,fetcher=fetch}){
 const headers={apikey:key,Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'};
 async function rpc(name,body){return fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}
 const response=await rpc('cc_private_record_versions_ready',{}),value=await response.json();
 if(!response.ok){if(response.status===404&&value?.code==='PGRST202'&&typeof value.message==='string'&&value.message.includes('public.cc_private_record_versions_ready'))return undefined;throw Error('Workspace history storage could not be verified.');}
 if(value!==true)throw Error('Workspace history protections are unavailable.');
 const versions=[];let after=null;
 for(;;){const result=await rpc('export_private_record_versions',{p_after:after});if(!result.ok)throw Error('Workspace history export failed.');const page=await result.json();if(!Array.isArray(page)||page.length>100||page.some((entry,index)=>entry?.owner_id!==ownerId||typeof entry.id!=='string'||entry.id<=(index?page[index-1].id:after||'')))throw Error('Workspace history page scope or order unverified.');versions.push(...page);if(versions.length>20000)throw Error('Workspace history exceeds its archive cap.');if(page.length<100)return versions;after=page.at(-1).id;}
}
export async function readPrivateWorkspaceDocuments({url,key,token,ownerId,fetcher=fetch}){
 const files=[];let last='',size=0;
 for(;;){
  const query=new URLSearchParams({select:'owner_id,id,content_key,metadata,file_envelope,version',owner_id:'eq.'+ownerId,order:'id.asc',limit:'1'});
  if(last)query.set('id','gt.'+last);
  const response=await fetcher(url+'/rest/v1/cc_private_documents?'+query,{headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Private document backup unavailable.');
  const page=await response.json();
  if(!Array.isArray(page)||page.length>1)throw Error('Invalid document inventory.');
  if(!page.length)return files;
  const row=page[0];
  if(!isDocumentId(row?.id)||row.id<=last||row.owner_id!==ownerId||typeof row.file_envelope!=='string')throw Error('Invalid document inventory.');
  size+=row.file_envelope.length;
  if(files.length>=MAX_ARCHIVE_DOCUMENTS||size>MAX_DOCUMENT_ENVELOPES)throw Error('Documents exceed the bounded backup size.');
  files.push(row);last=row.id;
 }
}
export async function backupPrivateWorkspace({project,includeDocuments=false},{configLoader=loadLocalConfig,apiFactory=createDevApi,fetcher=fetch,keyLoader=()=>readPrivatePreviewFile(resolve('.local/provider-storage/encryption-key'),{maxBytes:32,exactBytes:32}),writer=writePrivateWorkspace,directory=join(homedir(),'Library/Application Support/Curated Chaos/Recovery/WorkspaceSnapshots'),log=console.log}={}){
 const config=assertDevTarget(configLoader());if(config.ref!==project)throw Error('Unexpected workspace backup project.');const api=apiFactory({supabaseUrl:config.url,projectRef:project,publishableKey:config.publishableKey});let token,key,result;
 try{
  const signed=await api.signIn(config.users[0].email,config.users[0].password);token=signed?.accessToken;if(!token)throw Error('Temporary backup login failed.');const user=await api.getUser(token);if(!user?.id||!await api.isSessionActive(token))throw Error('Active private workspace owner required.');
  const args={url:config.url,key:config.publishableKey,token,ownerId:user.id,fetcher},first=await readPrivateWorkspace(args),firstVersions=await readPrivateWorkspaceVersions(args),firstDocuments=includeDocuments?await readPrivateWorkspaceDocuments(args):undefined,second=await readPrivateWorkspace(args),secondVersions=await readPrivateWorkspaceVersions(args),documents=includeDocuments?await readPrivateWorkspaceDocuments(args):undefined;if(stableStringify({rows:first,versions:firstVersions,documents:firstDocuments})!==stableStringify({rows:second,versions:secondVersions,documents}))throw Error('Workspace changed during backup review; nothing exported.');
  if((await api.getUser(token))?.id!==user.id||!await api.isSessionActive(token))throw Error('Backup session ended.');key=await keyLoader();validatePrivateWorkspaceRows(second,user.id,key);if(secondVersions!==undefined)validatePrivateRecordVersions(secondVersions,second,user.id,key);
  result=await writer({directory,key,projectRef:project,ownerId:user.id,rows:second,...(includeDocuments?{documents}:{}),...(secondVersions===undefined?{}:{recordVersions:secondVersions})});if(result?.verified!==true||result.recordCount!==second.length||includeDocuments&&result.documentCount!==documents.length||secondVersions!==undefined&&result.recordVersionCount!==secondVersions.length)throw Error('Encrypted workspace backup verification failed.');
 }finally{key?.fill(0);if(token)await api.signOutLocal(token);}
 log(JSON.stringify({verified:true,recordCount:result.recordCount,...(includeDocuments?{documentCount:result.documentCount}:{}),...(result.recordVersionCount===undefined?{}:{recordVersionCount:result.recordVersionCount}),localPath:result.path,encrypted:true,temporaryLoginClosed:true,databaseWrites:0,providerReads:0,restoreAttempted:false,scope:includeDocuments?'owner-private-records-history-and-documents':'owner-private-cc_records-including-trash-and-installed-history'}));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const approval=validateWorkspaceBackupArguments(process.argv.slice(2));if(approval)await backupPrivateWorkspace(approval);else console.log('PLAN ONLY: no credentials, keys, records, network or files accessed. After separate approval, --allow-private-workspace-backup --project=EXACT_DEV_PROJECT reads up to 2000 existing account-private app records (including deleted records and saved provider copies), includes protected prior versions when storage is installed, requires two matching source/history inventories, and creates/verifies one new encrypted backup on this Mac. Add --include-documents to include original private files with their names, folders, tags and revisions. Uses the existing key without changing it and closes its temporary login. Excludes shared household records, profiles/memberships, login credential files and connection grants. No database writes, provider refresh, restore, upload or live-app changes. This is not a complete database or hardware-loss backup.');}catch{console.error('Private workspace backup STOPPED. No credentials or record contents displayed. Existing files are not overwritten. A completed archive may exist if login cleanup failed; inspect before retrying.');process.exitCode=1;}}
