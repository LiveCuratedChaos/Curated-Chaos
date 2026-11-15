import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createSupabasePasswordRecovery} from '../server/supabase-password-recovery.mjs';
export function recoveryEmailArguments(args){if(!Array.isArray(args))throw Error('Recovery email arguments required.');if(!args.length)return null;if(args.length!==3||!args.includes('--allow-one-development-recovery-email')||!args.includes('--code-template-reviewed')||args.filter(v=>/^--project=[a-z0-9]{10,32}$/.test(v)).length!==1)throw Error('One explicit development recovery email and reviewed code template required.');return{project:args.find(v=>v.startsWith('--project=')).slice(10)};}
export async function requestDevelopmentRecoveryEmail({project,configLoader=loadLocalConfig,apiFactory=createSupabasePasswordRecovery}={}){
 if(typeof project!=='string'||!/^[a-z0-9]{10,32}$/.test(project))throw Error('Exact approved development project required.');
 const dev=assertDevTarget(configLoader());if(dev.ref!==project)throw Error('Approved development project does not match.');
 const api=apiFactory({supabaseUrl:dev.url,projectRef:dev.ref,publishableKey:dev.publishableKey});
 await api.sendRecoveryCode(dev.users[0].email);
 return{requestAccepted:true,recipient:'configured development account A',requests:1,passwordChanged:false,recordsAccessed:false,providersAccessed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const options=recoveryEmailArguments(process.argv.slice(2));if(options)console.log(JSON.stringify(await requestDevelopmentRecoveryEmail(options)));else console.log('PLAN ONLY: one recovery code email to configured development account A after approval and template review. No configuration read, network, email, password change or app-record access.');}catch{console.error('Recovery email request stopped. No private details displayed; do not automatically retry a request that may have been accepted.');process.exitCode=1;}}
