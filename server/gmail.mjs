// Server-only, metadata-first Gmail preparation. No OAuth route or live account is enabled.
// The caller must verify the app session and load the owner's grant from trusted storage.
import {createHash} from 'node:crypto';
export const GMAIL_READ_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value);
const clean=(value,max)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value))throw Error('Choose a Gmail window with explicit UTC offsets.');
 const date=new Date(value.slice(0,10)+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10)||!Number.isFinite(Date.parse(value)))throw Error('Choose valid Gmail window dates.');
 return Date.parse(value);
}
export function normalizeGmailMetadata(message,{ownerId,connectionId}){
 if(!UUID.test(ownerId||'')||!UUID.test(connectionId||''))throw Error('Verified Gmail connection owner required.');
 if(!message||!identifier(message.id)||!identifier(message.threadId)||!/^\d+$/.test(message.internalDate||''))throw Error('Gmail message identity could not be verified.');
 const timestamp=Number(message.internalDate);
 if(!Number.isSafeInteger(timestamp)||!Number.isFinite(new Date(timestamp).getTime()))throw Error('Gmail message date is invalid.');
 if(!Array.isArray(message.labelIds)||!message.labelIds.every(identifier))throw Error('Gmail message labels could not be verified.');
 if(!Array.isArray(message.payload?.headers))throw Error('Gmail message headers could not be verified.');
 const header=name=>{
  const values=message.payload.headers.filter(h=>typeof h?.name==='string'&&h.name.toLowerCase()===name);
  if(values.length>1||values.some(h=>typeof h.value!=='string'))throw Error('Gmail message headers are ambiguous.');
  return values[0]?.value||'';
 };
 const key=createHash('sha256').update(JSON.stringify([ownerId,'gmail',connectionId,message.id])).digest('hex');
 return {key,ownerId,connectionId,provider:'gmail',visibility:'private',messageId:message.id,threadId:message.threadId,
  receivedAt:new Date(timestamp).toISOString(),subject:clean(header('subject'),300)||'No subject',sender:clean(header('from'),500),labelIds:[...new Set(message.labelIds)]};
}
export async function readGmailWindow({ownerId,connectionId,grant,selectedLabelIds,accessToken,timeMin,timeMax},fetcher=fetch){
 if(!UUID.test(ownerId||'')||!UUID.test(connectionId||'')||grant?.ownerId!==ownerId||grant?.connectionId!==connectionId||grant.provider!=='gmail'||!Array.isArray(grant.scopes)||!grant.scopes.includes(GMAIL_READ_SCOPE))throw Error('Verified owner-approved Gmail read connection required.');
 if(!Array.isArray(selectedLabelIds)||selectedLabelIds.length<1||selectedLabelIds.length>10||!selectedLabelIds.every(identifier)||new Set(selectedLabelIds).size!==selectedLabelIds.length||!Array.isArray(grant.labelIds)||!selectedLabelIds.every(id=>grant.labelIds.includes(id))||selectedLabelIds.some(id=>['SPAM','TRASH','DRAFT'].includes(id)))throw Error('Choose explicitly approved Gmail labels.');
 if(typeof accessToken!=='string'||!accessToken.length||/[\s\u007f]/.test(accessToken))throw Error('Gmail authorization is unavailable.');
 const start=instant(timeMin),end=instant(timeMax);
 if(end<=start||end-start>31*86400000)throw Error('Choose a Gmail window of up to 31 days.');
 async function request(url){
  let response;
  try{response=await fetcher(url.href,{method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch{throw Error('Gmail could not be reached. No partial result was accepted.');}
  if(!response.ok)throw Error(response.status===401?'Gmail authorization expired. Reconnect to continue.':response.status===403?'Gmail access was denied. Review approved permissions.':'Gmail refresh failed. No partial result was accepted.');
  let data;try{data=await response.json();}catch{throw Error('Gmail response could not be verified.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Gmail response could not be verified.');
  return data;
 }
 const base='https://gmail.googleapis.com/gmail/v1/users/me/messages',ids=new Set(),tokens=new Set();let pageToken='',complete=false;
 for(let page=0;page<20;page++){
  const url=new URL(base);url.searchParams.set('maxResults','100');url.searchParams.set('includeSpamTrash','false');
  // Expand to second boundaries, then enforce exact millisecond bounds on each message.
  url.searchParams.set('q',`after:${Math.floor(start/1000)-1} before:${Math.ceil(end/1000)} -in:drafts`);
  url.searchParams.set('fields','messages(id),nextPageToken');
  for(const label of selectedLabelIds)url.searchParams.append('labelIds',label);
  if(pageToken)url.searchParams.set('pageToken',pageToken);
  const data=await request(url);
  if(data.messages!==undefined&&!Array.isArray(data.messages))throw Error('Gmail message list could not be verified.');
  for(const item of data.messages||[]){if(!identifier(item?.id))throw Error('Gmail message identifier is invalid.');ids.add(item.id);if(ids.size>250)throw Error('Too many matching messages. Choose a smaller window or narrower label selection.');}
  if(data.nextPageToken===undefined||data.nextPageToken===''){complete=true;break;}
  if(typeof data.nextPageToken!=='string'||data.nextPageToken.length>2048||/[\u0000-\u0020\u007f]/.test(data.nextPageToken)||tokens.has(data.nextPageToken))throw Error('Gmail pagination could not be verified.');
  pageToken=data.nextPageToken;tokens.add(pageToken);
 }
 if(!complete)throw Error('Gmail window needs too many pages. Narrow the selection.');
 const messages=[];
 for(const id of ids){
  const url=new URL(base+'/'+encodeURIComponent(id));url.searchParams.set('format','metadata');
  url.searchParams.append('metadataHeaders','Subject');url.searchParams.append('metadataHeaders','From');
  url.searchParams.set('fields','id,threadId,internalDate,labelIds,payload(headers)');
  const data=await request(url);
  if(data.id!==id)throw Error('Gmail message identity changed while loading.');
  const message=normalizeGmailMetadata(data,{ownerId,connectionId});
  const received=Date.parse(message.receivedAt);
  // Labels can change between listing and reading. Never import a message outside consent.
  if(received<start||received>=end||!selectedLabelIds.every(label=>message.labelIds.includes(label))||message.labelIds.some(label=>['SPAM','TRASH','DRAFT'].includes(label)))continue;
  messages.push(message);
 }
 return {provider:'gmail',ownerId,connectionId,timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),selectedLabelIds:[...selectedLabelIds],complete:true,content:'metadata-only',messages};
}
