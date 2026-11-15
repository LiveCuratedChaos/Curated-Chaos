// Offline recovery kit for local credentials/key only, not a database backup.
import {scrypt as derive,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {lstat,readFile,readdir,writeFile,realpath} from 'node:fs/promises';
import {join,resolve,relative,dirname} from 'node:path';
const scrypt=promisify(derive),MAX_BYTES=8*1024*1024,MAX_FILES=1000;
const singles=['.env.local','.local/google-oauth.json','.local/plaid-sandbox.json','.local/plaid-production.json'];
const dirs=['.local/provider-storage','.local/plaid-connections'];
const allowed=path=>singles.includes(path)||dirs.some(dir=>path.startsWith(dir+'/')&&!['.','..'].includes(path.slice(dir.length+1))&&/^[a-zA-Z0-9_.-]+$/.test(path.slice(dir.length+1)));
function checkPassword(password){if(typeof password!=='string'||password.length<16||Buffer.byteLength(password)>1024)throw Error('Use a recovery password of at least 16 characters.');}
async function safeInfo(path,directory=false){const info=await lstat(path);if(info.isSymbolicLink()||(directory?!info.isDirectory():!info.isFile())||(info.mode&0o077))throw Error('Recovery source must use private files and directories without links.');return info;}
export async function collectRecoveryFiles(root){
 root=await realpath(root);const entries=[];let bytes=0;
 async function add(path){const full=join(root,path),info=await safeInfo(full);if(info.size>MAX_BYTES||bytes+info.size>MAX_BYTES||entries.length>=MAX_FILES)throw Error('Recovery source exceeds the size limit.');const data=await readFile(full);bytes+=data.length;if(bytes>MAX_BYTES)throw Error('Recovery source exceeds the size limit.');entries.push({path,data:data.toString('base64')});}
 for(const path of singles){try{await lstat(join(root,path));}catch(err){if(err.code==='ENOENT')continue;throw err;}if(path.startsWith('.local/')){const info=await lstat(join(root,'.local'));if(!info.isDirectory()||info.isSymbolicLink())throw Error('Private storage directory required.');}await add(path);}
 for(const dir of dirs){try{await lstat(join(root,dir));}catch(err){if(err.code==='ENOENT')continue;throw err;}const parent=await lstat(join(root,'.local'));if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('Private storage directory required.');await safeInfo(join(root,dir),true);for(const name of (await readdir(join(root,dir))).sort()){const path=dir+'/'+name;if(!allowed(path))throw Error('Unexpected recovery source path.');await add(path);}}
 if(!entries.some(e=>e.path==='.local/provider-storage/encryption-key'))throw Error('Original encryption key required; no replacement will be created.');
 return {version:1,scope:'local-key-and-credentials-only',createdAt:new Date().toISOString(),entries};
}
function validateKit(kit){
 if(kit?.version!==1||kit.scope!=='local-key-and-credentials-only'||!Array.isArray(kit.entries)||kit.entries.length>MAX_FILES)throw Error();
 const seen=new Set();let size=0;
 for(const entry of kit.entries){if(!allowed(entry?.path)||seen.has(entry.path)||typeof entry.data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data))throw Error();seen.add(entry.path);size+=Buffer.byteLength(entry.data,'base64');if(size>MAX_BYTES)throw Error();}
 const key=kit.entries.find(e=>e.path==='.local/provider-storage/encryption-key');if(!key||Buffer.from(key.data,'base64').length!==32)throw Error();return kit;
}
async function deriveKey(password,salt){return scrypt(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});}
const aad=Buffer.from('curated-chaos-local-recovery-v1');
export async function sealRecoveryKit(kit,password){
 checkPassword(password);validateKit(kit);const salt=randomBytes(16),iv=randomBytes(12),key=await deriveKey(password,salt);
 try{const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);const encrypted=Buffer.concat([cipher.update(JSON.stringify(kit)),cipher.final()]);return JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),encrypted:encrypted.toString('base64')});}finally{key.fill(0);}
}
export async function openRecoveryKit(envelope,password){
 checkPassword(password);let key;
 try{if(typeof envelope!=='string'||Buffer.byteLength(envelope)>20*1024*1024)throw Error();const row=JSON.parse(envelope);if(row.version!==1||['salt','iv','tag','encrypted'].some(k=>typeof row[k]!=='string'))throw Error();const salt=Buffer.from(row.salt,'base64'),iv=Buffer.from(row.iv,'base64'),tag=Buffer.from(row.tag,'base64');if(salt.length!==16||iv.length!==12||tag.length!==16)throw Error();key=await deriveKey(password,salt);const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad);decipher.setAuthTag(tag);return validateKit(JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.encrypted,'base64')),decipher.final()]).toString('utf8')));}catch{throw Error('Recovery copy could not be verified. Check the password and original file.');}finally{key?.fill(0);}
}
export async function writeRecoveryKit(root,output,password){
 const actualRoot=await realpath(root),parent=await realpath(dirname(resolve(output))),target=join(parent,resolve(output).split('/').pop());
 const rel=relative(actualRoot,target);if(!(rel==='..'||rel.startsWith('../')))throw Error('Recovery copy must be outside the project directory.');
 await safeInfo(parent,true);const kit=await collectRecoveryFiles(actualRoot),envelope=await sealRecoveryKit(kit,password),verified=await openRecoveryKit(envelope,password);
 const left=Buffer.from(JSON.stringify(kit)),right=Buffer.from(JSON.stringify(verified));if(left.length!==right.length||!timingSafeEqual(left,right))throw Error('Recovery verification failed.');
 await writeFile(target,envelope,{flag:'wx',mode:0o600});const disk=await readFile(target,'utf8');if(disk!==envelope)throw Error('Recovery file verification failed.');
 return {verified:true,files:kit.entries.length,databaseBackup:false,encrypted:true};
}
