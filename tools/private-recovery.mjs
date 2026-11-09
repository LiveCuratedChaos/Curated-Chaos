// Passwords are entered only in a local terminal, never argv, environment or chat.
import {mkdir,readFile,lstat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {writeRecoveryKit,openRecoveryKit} from '../server/private-recovery.mjs';
function hiddenPassword(prompt){
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')throw Error('Open this tool in a local Terminal to enter the recovery password privately.');
 return new Promise((yes,no)=>{
  let value='';const previous=process.stdin.isRaw;
  const done=(error)=>{process.stdin.off('data',input);process.stdin.setRawMode(previous);process.stdin.pause();process.stderr.write('\n');if(error)no(error);else yes(value);};
  const input=chunk=>{for(const char of chunk.toString('utf8')){if(char==='\u0003'){done(Error('Recovery cancelled.'));return;}if(char==='\r'||char==='\n'){done();return;}if(char==='\u007f'||char==='\b'){value=[...value].slice(0,-1).join('');continue;}if(char>=' '){value+=char;if(Buffer.byteLength(value)>1024){done(Error('Recovery password is too long.'));return;}}}};
  process.stderr.write(prompt);process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();process.stdin.on('data',input);
 });
}
const args=process.argv.slice(2),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
 if(!args.length){console.log('PLAN ONLY: prepare a password-protected local key/credential recovery copy outside the project. No credentials read, network requests, database operations or files written. Run --create in a local Terminal, or --verify <recovery-file>. This is not a database backup.');}
 else if(args.length===1&&args[0]==='--create'){
  const password=await hiddenPassword('Choose a recovery password (at least 16 characters; input hidden): ');if(password.length<16)throw Error('Use a recovery password of at least 16 characters.');const repeated=await hiddenPassword('Enter it again (input hidden): ');if(password!==repeated)throw Error('Passwords did not match. Nothing backed up.');
  const directory=join(homedir(),'Library','Application Support','Curated Chaos','Recovery');await mkdir(directory,{recursive:true,mode:0o700});
  const output=join(directory,'curated-chaos-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.ccrecovery');const result=await writeRecoveryKit(root,output,password);console.log('Encrypted local recovery copy saved and verified. '+result.files+' files protected. Database records are not included.\nSaved at: '+output+'\nKeep the password separately in your password manager. Do not send it in chat.');
 }else if(args.length===2&&args[0]==='--verify'){
  const path=resolve(args[1]),info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)||info.size>20*1024*1024)throw Error('Use a private original recovery file.');const password=await hiddenPassword('Recovery password (input hidden): ');const kit=await openRecoveryKit(await readFile(path,'utf8'),password);console.log('Recovery copy verified: '+kit.entries.length+' files. No files restored or overwritten; no network or database operation.');
 }else throw Error('Use no arguments for the offline plan, --create, or --verify <recovery-file>.');
}catch{console.error('Recovery did not complete. Check the local password, file permissions and destination. Existing files and keys were not replaced. No secrets are displayed.');process.exitCode=1;}
