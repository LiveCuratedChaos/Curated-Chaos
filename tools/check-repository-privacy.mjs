// Read-only Git guard. Private file paths are checked without opening them; opt-in candidate content scanning never prints matches or modifies Git.
import {scanRepositoryContents,privateRepositoryPath} from '../server/repository-content-scan.mjs';
import {realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const probes=['.env','.env.local','.env.production','.local/provider-storage/encryption-key','.local/google-oauth.json','.local/plaid-production.json','node_modules/privacy-probe','recovery.ccrecovery','providers.ccsnapshot','workspace.ccworkspace'];
export function checkRepositoryPrivacy(root,{scanContent=false,onFinding}={}){
 const run=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 if(realpathSync(run(['rev-parse','--show-toplevel']).trim())!==realpathSync(root))throw Error('Run the privacy check from the project repository root.');
 let unprotectedPaths=0;
 for(const probe of probes){
  try{run(['check-ignore','--no-index','-q','--',probe]);}catch(error){if(error.status!==1)throw Error('Git ignore rules could not be verified.');unprotectedPaths++;}
 }
 const tracked=run(['ls-files','-z']).split('\0').filter(Boolean);

 const trackedPrivateFiles=tracked.filter(privateRepositoryPath).length;
 const content=scanContent?scanRepositoryContents(root,{onFinding}):null;
 return {safe:unprotectedPaths===0&&trackedPrivateFiles===0&&(!content||content.findingSources===0&&content.privateArchiveEntries===0&&content.blockedSources===0),unprotectedPaths,trackedPrivateFiles,checkedIgnoreRules:probes.length,contentScan:Boolean(scanContent),...(content?{content}:{})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.slice(2).some(arg=>arg!=='--scan-content')||process.argv.slice(2).length>1)throw Error();const result=checkRepositoryPrivacy(process.cwd(),{scanContent:process.argv.includes('--scan-content')});console.log(JSON.stringify(result));if(!result.safe)process.exitCode=1;}catch{console.error('Repository privacy check unavailable. Verify Git is installed and this is the project repository root.');process.exitCode=1;}
}
