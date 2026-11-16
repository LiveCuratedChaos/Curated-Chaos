// Offline preparation inventory. Never loads private configuration or certifies deployment.
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const templateKeys=Object.freeze(['CC_DEV_SUPABASE_URL','CC_DEV_PROJECT_REF','CC_ORIGINAL_PROJECT_REF','CC_DEV_PUBLISHABLE_KEY','CC_CONFIRM_NEW_DEV_PROJECT','CC_TEST_A_EMAIL','CC_TEST_A_PASSWORD','CC_TEST_B_EMAIL','CC_TEST_B_PASSWORD']);
export function validateTemplate(content){
  const rows=content.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
  const entries=rows.map(line=>/^([A-Z0-9_]+)=<[A-Z0-9_]+>$/.exec(line));
  return entries.every(Boolean)&&entries.length===templateKeys.length&&new Set(entries.map(entry=>entry?.[1])).size===templateKeys.length&&entries.every(entry=>templateKeys.includes(entry[1]));
}
export function checkDeploymentReadiness({read=path=>readFileSync(resolve(root,path),'utf8')}={}){
  // Explicit allowlist: never enumerate a checkout or read .env.local/.local/provider storage.
  const checks=[];
  for(const [name,path,validate]of [
    ['sanitized-development-template','.env.example',validateTemplate],
    ['node-and-declared-dependency-contract','package.json',text=>{const p=JSON.parse(text);return p.engines?.node==='>=22'&&typeof p.dependencies?.['google-auth-library']==='string'&&typeof p.devDependencies?.['@electric-sql/pglite']==='string';}]
  ]){
    try{checks.push({name,passed:validate(read(path))===true});}catch{checks.push({name,passed:false});}
  }
  return {offlinePreparationPassed:checks.every(check=>check.passed),productionReady:false,status:'blocked',checks,
    boundaries:{runtime:'local-loopback-only',configuration:'separate-development-only',publicPublishRoot:'repository-root-forbidden',realServicesChecked:false},
    blockers:[
      'No approved production hosting adapter and restricted public artifact have been accepted.',
      'Durable production sessions, secret storage, provider jobs and restart/revocation behavior need staged acceptance.',
      'Separate staging targets, HTTPS cookie/origin policy and provider callback/scopes need owner-approved configuration.',
      'Production migration, backup/restore, rollback, device and security acceptance evidence is required.',
      'Live deployment and migration require explicit owner approval.'
    ]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){console.error('Offline readiness inventory accepts no arguments.');process.exitCode=1;}
  else{const report=checkDeploymentReadiness();console.log(JSON.stringify(report,null,2));process.exitCode=1;}
}
