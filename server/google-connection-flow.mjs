// Testable server-only orchestration around Google's official OAuth2Client interface.
// No default stores/client/routes: production wiring must supply durable atomic storage,
// the official library, verified app sessions, and keys from secret management.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {GOOGLE_CALENDAR_READ_SCOPE} from './google-calendar.mjs';
import {GMAIL_READ_SCOPE} from './gmail.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scopes={google_calendar:GOOGLE_CALENDAR_READ_SCOPE,gmail:GMAIL_READ_SCOPE};
const hash=value=>createHash('sha256').update(value).digest('hex');
function session(ownerId,binding){if(!UUID.test(ownerId||'')||typeof binding!=='string'||binding.length<16)throw Error('A verified app session is required.');return hash(binding);}
export function createGoogleConnectionFlow({clientId,oauthClient,stateStore,connectionStore,sealer,confirmSession,now=()=>Date.now()}){
 if(typeof clientId!=='string'||!clientId.endsWith('.apps.googleusercontent.com')||!oauthClient?.generateCodeVerifierAsync||!oauthClient.generateAuthUrl||!oauthClient.getToken||!oauthClient.verifyIdToken||!stateStore?.put||!stateStore.consume||!connectionStore?.insert||!sealer?.seal||!sealer.unseal||typeof confirmSession!=='function')throw Error('Google connection services are not configured.');
 async function begin({ownerId,sessionBinding,provider}){
  const binding=session(ownerId,sessionBinding);if(typeof provider!=='string'||!Object.hasOwn(scopes,provider))throw Error('Unsupported Google connection.');const scope=scopes[provider];
  if(!await confirmSession(ownerId,binding))throw Error('App session ended. Sign in again.');
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),stateKey=hash(state);
  const {codeVerifier,codeChallenge}=await oauthClient.generateCodeVerifierAsync();
  const expiresAt=now()+5*60*1000;
  await stateStore.put(stateKey,{expiresAt,encrypted:sealer.seal({ownerId,binding,provider,nonce,codeVerifier,expiresAt},'oauth-state:'+stateKey)});
  const authorizationUrl=oauthClient.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['openid','email',scope],state,nonce,code_challenge:codeChallenge,code_challenge_method:'S256',include_granted_scopes:false});
  const url=new URL(authorizationUrl);
  if(url.origin!=='https://accounts.google.com'||url.username||url.password)throw Error('Google authorization destination is invalid.');
  return {authorizationUrl,expiresAt};
 }
 async function complete({ownerId,sessionBinding,state,code}){
  const binding=session(ownerId,sessionBinding);
  if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state)||typeof code!=='string'||!code.length||code.length>4096)throw Error('Google authorization callback is invalid.');
  // consume MUST be atomic across requests/processes; a normal read+delete is insufficient.
  const key=hash(state),stored=await stateStore.consume(key);if(!stored)throw Error('Google authorization expired or was already used.');
  const attempt=sealer.unseal(stored.encrypted,'oauth-state:'+key);
  if(attempt.ownerId!==ownerId||attempt.binding!==binding||!Object.hasOwn(scopes,attempt.provider)||!Number.isFinite(attempt.expiresAt)||attempt.expiresAt<=now()||!await confirmSession(ownerId,binding))throw Error('Google authorization does not match the current app session.');
  let tokens,payload;
  try{
   ({tokens}=await oauthClient.getToken({code,codeVerifier:attempt.codeVerifier}));
   const ticket=await oauthClient.verifyIdToken({idToken:tokens.id_token,audience:clientId});payload=ticket.getPayload();
  }catch{throw Error('Google authorization could not be verified. Reconnect to continue.');}
  const granted=typeof tokens.scope==='string'?tokens.scope.split(/\s+/):[];
  if(payload?.nonce!==attempt.nonce||typeof payload?.sub!=='string'||!payload.sub||payload.sub.length>255||payload.email_verified!==true||typeof payload.email!=='string'||!payload.email.trim()||payload.email.length>320||typeof tokens.refresh_token!=='string'||!tokens.refresh_token.length||/[\s\u007f]/.test(tokens.refresh_token)||!granted.includes(scopes[attempt.provider]))throw Error('Google did not return the required verified read authorization. Reconnect to continue.');
  if(!await confirmSession(ownerId,binding))throw Error('App session ended before the connection could be saved.');
  const connectionId=randomUUID();
  const encrypted=sealer.seal({refreshToken:tokens.refresh_token,googleSubject:payload.sub,email:payload.email},'provider:'+ownerId+':'+connectionId);
  await connectionStore.insert({ownerId,connectionId,provider:attempt.provider,scope:scopes[attempt.provider],encrypted,createdAt:now()});
  return {connectionId,provider:attempt.provider,accountLabel:payload.email,status:'authorized',selectionRequired:true};
 }
 return {begin,complete};
}
