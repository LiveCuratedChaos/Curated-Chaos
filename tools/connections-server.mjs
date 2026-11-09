import {createSealedMacCalendarRepository} from '../server/sealed-mac-calendar-repository.mjs';
import {validateMacCalendarScope} from '../server/mac-calendar-bridge.mjs';
import {createMacCalendarGrantPublisher} from '../server/mac-calendar-grant-file.mjs';
import {createSealedFinanceRepository} from '../server/sealed-finance-repository.mjs';
import {createDevProviderRepository} from '../server/dev-provider-repository.mjs';
// Optional local development entrypoint. Never deploy this in-memory gateway.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OAuth2Client} from 'google-auth-library';
import {makeHandler,sanitizedDevConfig} from './local-server.mjs';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
import {makeGoogleDevelopmentHandler} from '../server/google-development-handler.mjs';
export const CONNECTION_ORIGIN='http://127.0.0.1:5301';
export const GOOGLE_CALLBACK=CONNECTION_ORIGIN+'/auth/google/callback';
export async function makeConnectionsServer(root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),{approvedImportSelections=[],maxReviewedImportItems=0,approvedMacCalendarScope=null,allowMacCalendarIdentityReview=false,allowMacCalendarSave=false,expectedMacSaveProject=null,requireActiveSession=false,expectedSessionProject=null}={}){
 if(requireActiveSession&&!expectedSessionProject)throw Error('Exact development target required for active session checks.');
 const macScope=approvedMacCalendarScope?validateMacCalendarScope(approvedMacCalendarScope):null;
 const publishMacCalendarGrant=macScope?createMacCalendarGrantPublisher(resolve(root,'.local/calendar-preview-bridge.json')):null;
 if(allowMacCalendarSave&&(!allowMacCalendarIdentityReview||!macScope||macScope.maxEvents>5||!expectedMacSaveProject))throw Error('Exact development target and bounded Mac save approval required.');
 if(allowMacCalendarIdentityReview&&!macScope)throw Error('Explicit Mac scope required for identity review.');
 let options={requireActiveSession,allowMacCalendarIdentityReview,allowMacCalendarSave,approvedMacCalendarScope:macScope,publishMacCalendarGrant,origin:CONNECTION_ORIGIN,approvedImportSelections,maxReviewedImportItems};
 let source;
 try{source=await readFile(resolve(root,'.local/google-oauth.json'),'utf8');}catch(err){if(err.code!=='ENOENT')throw Error('Google development credential file could not be read.');}
 if(source){
  let web;try{web=JSON.parse(source).web;}catch{throw Error('Google development credential file is invalid.');}
  if(!web?.client_id?.endsWith('.apps.googleusercontent.com')||typeof web.client_secret!=='string'||!web.client_secret||!Array.isArray(web.redirect_uris)||!web.redirect_uris.includes(GOOGLE_CALLBACK))throw Error('Google development credentials do not match the expected callback.');
  const localConfig=loadLocalConfig(resolve(root,'.env.local'));if(allowMacCalendarSave&&assertDevTarget(localConfig).ref!==expectedMacSaveProject)throw Error('Unexpected Mac save development target.');if(requireActiveSession&&assertDevTarget(localConfig).ref!==expectedSessionProject)throw Error('Unexpected development session target.');const publicConfig=sanitizedDevConfig(localConfig);
  const stores=await createLocalProviderStore(resolve(root,'.local/provider-storage'));
  options={...options,macCalendarRepository:createSealedMacCalendarRepository(createDevProviderRepository(publicConfig,{expectedProjectRef:publicConfig.projectRef}),stores.sealer),supabaseOrigin:publicConfig.supabaseUrl,providerRepository:createDevProviderRepository(publicConfig,{expectedProjectRef:publicConfig.projectRef}),financeRepository:createSealedFinanceRepository(createDevProviderRepository(publicConfig,{expectedProjectRef:publicConfig.projectRef}),stores.sealer),devApi:createDevApi(publicConfig),stores,clientId:web.client_id,refreshAccessToken:async refreshToken=>{const client=new OAuth2Client({clientId:web.client_id,clientSecret:web.client_secret,redirectUri:GOOGLE_CALLBACK});client.setCredentials({refresh_token:refreshToken});const {token}=await client.getAccessToken();if(!token)throw Error('Reconnect Google to preview.');return token;},oauthClient:new OAuth2Client({clientId:web.client_id,clientSecret:web.client_secret,redirectUri:GOOGLE_CALLBACK})};
 }
 if((allowMacCalendarSave||requireActiveSession)&&!source)throw Error('Configured development gateway required.');
 const google=makeGoogleDevelopmentHandler(options),staticHandler=makeHandler(root);
 const server=createServer(async(req,res)=>{try{if(!await google(req,res))await staticHandler(req,res);}catch{res.writeHead(500,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Development server error. No credentials are displayed.');}});
 if(publishMacCalendarGrant)server.on('close',()=>{publishMacCalendarGrant.dispose().catch(()=>{});});return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const approvedImportSelections=process.argv.filter(arg=>arg.startsWith('--allow-reviewed-selection=')).map(arg=>arg.slice('--allow-reviewed-selection='.length));const maxReviewedImportItems=Number(process.argv.find(arg=>arg.startsWith('--max-reviewed-items='))?.slice('--max-reviewed-items='.length)||0);const value=name=>process.argv.find(arg=>arg.startsWith('--mac-'+name+'='))?.split('=').slice(1).join('=');const approvedMacCalendarScope=process.argv.includes('--allow-mac-calendar-preview-transfer')?validateMacCalendarScope({calendarCount:Number(value('calendars')),maxEvents:Number(value('max-events')),startDate:value('start'),endDateExclusive:value('end'),timeZone:value('zone')}):null;const server=await makeConnectionsServer(undefined,{requireActiveSession:process.argv.includes('--require-active-development-session'),expectedSessionProject:process.argv.find(arg=>arg.startsWith('--session-check-project='))?.slice('--session-check-project='.length),approvedImportSelections,maxReviewedImportItems,approvedMacCalendarScope,allowMacCalendarIdentityReview:process.argv.includes('--allow-mac-calendar-identity-review'),allowMacCalendarSave:process.argv.includes('--allow-mac-calendar-save-reviewed'),expectedMacSaveProject:process.argv.find(arg=>arg.startsWith('--mac-save-project='))?.slice('--mac-save-project='.length)});server.on('error',()=>{console.error('Development connection server could not start. Check whether port 5301 is already in use.');process.exitCode=1;});server.listen(5301,'127.0.0.1',()=>console.log('Development connections: '+CONNECTION_ORIGIN+'/auth/google/\nNo Google data is imported by this gateway.'));}
 catch{console.error('Development Google setup is incomplete or failed its safety checks. No credentials are displayed.');process.exitCode=1;}
}
