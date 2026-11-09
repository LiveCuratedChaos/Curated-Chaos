import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
function validatePlaidConfig(value,environment){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['environment','clientId','secret'].includes(key))||value.environment!==environment||!/^\w{16,64}$/.test(value.clientId||'')||!/^[A-Za-z0-9_-]{16,256}$/.test(value.secret||''))throw Error('Valid environment-specific Plaid credentials required.');
 return {environment,clientId:value.clientId,secret:value.secret};
}
export const validatePlaidSandboxConfig=value=>validatePlaidConfig(value,'sandbox');
async function loadPrivateConfig(root,environment){
 const directory=join(root,'.local'),file=join(directory,'plaid-'+environment+'.json');
 const parent=await lstat(directory),stat=await lstat(file);
 if(!parent.isDirectory()||parent.isSymbolicLink()||!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Plaid credentials must be in a private regular local file.');
 let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch{throw Error('Plaid credential file could not be read.');}return validatePlaidConfig(data,environment);
}

export const loadPlaidSandboxConfig=root=>loadPrivateConfig(root,'sandbox');
export function loadPlaidProductionConfig(root,{approved=false}={}){if(approved!==true)throw Error('Production credential use requires explicit approval.');return loadPrivateConfig(root,'production');}
