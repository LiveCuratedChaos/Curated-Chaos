// Development-only setup convenience. Searches prior M2C Fixed, M2C, M2B, M2A and M1H Fixed folders.
// Never prints secrets or touches the original working environment.
import {existsSync,copyFileSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=join(project,'.env.local');
const dirs=['Curated_Chaos_Development_Starter_M2C_Fixed','Curated_Chaos_Development_Starter_M2C','Curated_Chaos_Development_Starter_M2B','Curated_Chaos_Development_Starter_M2A_Fixed','Curated_Chaos_Development_Starter_M2A','Curated_Chaos_Development_Starter_M1H_Fixed'];
const candidates=dirs.flatMap(dir=>[
 join(dirname(project),dir,'.env.local'),
 join(homedir(),'Desktop',dir,'.env.local'),
 join(homedir(),'Desktop','Curated Chaos Development',dir,'.env.local'),
 join(homedir(),'Desktop','Curated_Chaos_Development',dir,'.env.local')
]);
try{
 if(!existsSync(destination)){
  const found=candidates.find(p=>existsSync(p));
  if(!found)throw Error('Previous M2C Fixed, M2C, M2B, M2A Fixed, M2A or M1H_Fixed configuration not found in expected folders. Copy .env.local manually from your previous working M2C Fixed folder.');
  // Validate before copying. No production fallback is ever permitted.
  assertDevTarget(loadLocalConfig(found));
  copyFileSync(found,destination);
  console.log('Reused validated isolated development configuration from the previous working folder.');
 }else console.log('Keeping this folder’s existing development configuration; not overwriting it.');
 chmodSync(destination,0o600);
 const target=assertDevTarget(loadLocalConfig(destination));
 console.log('Isolated development project verified: '+target.ref+' (credentials are not displayed).');
}catch(err){console.error('Development configuration setup failed: '+err.message);process.exitCode=1;}
