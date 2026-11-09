// Explicitly approved, bounded development import. Default mode is entirely offline.
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {OAuth2Client} from 'google-auth-library';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {createDevProviderRepository} from '../server/dev-provider-repository.mjs';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
import {createGoogleSourcePreview} from '../server/google-source-preview.mjs';
import {createProviderImportExecutor} from '../server/provider-import-executor.mjs';
import {validateGoogleSourceSelection} from '../server/google-source-selection.mjs';
export function validateImportArguments(argv){
 const get=name=>argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
 const project=get('project'),maxItems=Number(get('max-items')),startDate=get('start'),endDate=get('end');
 if(!argv.includes('--allow-real-gmail-import'))return null;
 if(!/^[a-z0-9]{10,32}$/.test(project||'')||!Number.isInteger(maxItems)||maxItems<1||maxItems>250)throw Error('An exact approved development project and item cap are required.');
 const selection=validateGoogleSourceSelection('gmail',{source:'INBOX',startDate,endDate});
 return {project,maxItems,selection};
}
async function run(approved){
 const config=assertDevTarget(loadLocalConfig());if(config.ref!==approved.project)throw Error('Unexpected development project.');
 const publicConfig={supabaseUrl:config.url,projectRef:config.ref,publishableKey:config.publishableKey},api=createDevApi(publicConfig);
 // The original approved source grants belong to the existing Test Account A.
 const signed=await api.signIn(config.users[0].email,config.users[0].password),user=await api.getUser(signed.accessToken);
 if(!user?.id)throw Error('Development account could not be verified.');
 const actor={ownerId:user.id,accessToken:signed.accessToken,sessionBinding:randomUUID()},stores=await createLocalProviderStore(resolve('.local/provider-storage'));
 const candidates=(await stores.connectionStore.listOwner(actor.ownerId)).filter(c=>c.provider==='gmail'&&c.status==='authorized'&&c.sourceSelection?.selection?.timeMin===approved.selection.timeMin&&c.sourceSelection.selection.timeMax===approved.selection.timeMax&&c.sourceSelection.selection.labelIds?.length===1&&c.sourceSelection.selection.labelIds[0]==='INBOX');
 if(candidates.length!==1)throw Error('Exactly one approved, active Inbox selection is required.');
 const connectionId=candidates[0].connectionId,selectionId=candidates[0].sourceSelection.selectionId;
 const current=await stores.connectionStore.loadSelected(actor.ownerId,connectionId,selectionId);
 if(current.provider!=='gmail'||current.selection.timeMin!==approved.selection.timeMin||current.selection.timeMax!==approved.selection.timeMax)throw Error('Source selection changed.');
 const web=JSON.parse(await readFile(resolve('.local/google-oauth.json'),'utf8')).web;
 if(web?.project_id!=='curated-chaos-development'||!web.client_id?.endsWith('.apps.googleusercontent.com')||!web.client_secret)throw Error('Unexpected Google development credential.');
 const confirmSession=async owner=>(await api.getUser(actor.accessToken))?.id===owner;
 const previewer=createGoogleSourcePreview({connectionStore:stores.connectionStore,confirmSession,refreshAccessToken:async refreshToken=>{const client=new OAuth2Client({clientId:web.client_id,clientSecret:web.client_secret});client.setCredentials({refresh_token:refreshToken});const {token}=await client.getAccessToken();if(!token)throw Error('Reconnect Gmail before importing.');return token;}});
 const preview=await previewer({ownerId:actor.ownerId,binding:actor.sessionBinding,connectionId,selectionId,confirmed:true});
 if(preview.result.messages.length>approved.maxItems)throw Error('The preview exceeds the approved item cap.');
 const selectedKeys=preview.result.messages.map(m=>m.key),allowedKeys=new Set(selectedKeys);
 const repository=createDevProviderRepository(publicConfig,{expectedProjectRef:approved.project});
 const executor=createProviderImportExecutor({repository,resolveActor:async candidate=>await confirmSession(candidate.ownerId)?{ownerId:candidate.ownerId,sessionBinding:candidate.sessionBinding}:null,
  validateSourceSelection:async(_actor,session,args)=>{if(session.ownerId!==actor.ownerId||args.connectionId!==connectionId||args.selectionId!==selectionId)throw Error('Source identity changed.');await stores.connectionStore.loadSelected(session.ownerId,connectionId,selectionId);},
  authorizeWrite:async(_actor,args)=>!args.fixtureRunId&&args.selectionId===selectionId&&args.selectedKeys.length<=approved.maxItems&&args.selectedKeys.every(key=>allowedKeys.has(key))});
 const args={connectionId,selectionId,preview,selectedKeys,previewExpiresAt:Date.now()+300000};
 const review=await executor.prepare(actor,args);
 if(review.conflictCount)throw Error('Existing saved items require separate conflict review.');
 const receipt=await executor.execute(actor,{reviewId:review.reviewId,approved:true});
 console.log(JSON.stringify({verified:true,provider:'gmail',source:'INBOX',start:approved.selection.timeMin,endExclusive:approved.selection.timeMax,matched:selectedKeys.length,inserted:receipt.inserted,alreadySaved:receipt.unchanged,verifiedAt:receipt.verifiedAt}));
 console.log('Approved private metadata import verified. No subjects, senders, tokens or message identifiers are printed. No bodies, attachments, Google edits, schema changes or deployment.');
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 try{const approved=validateImportArguments(process.argv.slice(2));if(approved){await run(approved);}else{
  console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');
  console.log('Requires explicit owner approval, --allow-real-gmail-import, --project=EXACT_DEV_PROJECT, --max-items=APPROVED_CAP, --start=YYYY-MM-DD and --end=YYYY-MM-DD (end excluded, UTC).');
  console.log('Imports only subject/sender/time/identity metadata from the unique active saved Inbox selection for existing Test Account A. Changed sources, excessive counts or existing-record conflicts stop before saving. No bodies, attachments, Google modifications or production changes.');
 }}catch{console.error('Approved Gmail import STOPPED. Credentials and source content are not printed. Check current saved items before any retry; an uncertain save must not be repeated blindly.');process.exitCode=1;}
}
