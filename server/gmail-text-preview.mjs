// Explicit one-message content preview. No database writes, attachments endpoint or source changes.
import {GMAIL_READ_SCOPE,normalizeGmailMetadata} from './gmail.mjs';
import {suggestGmailMessageCategories} from './gmail-message-candidates.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function plainTextFromGmail(payload){
 let nodes=0,bytes=0;const pieces=[];
 function visit(part,depth){
  if(!part||typeof part!=='object'||Array.isArray(part)||++nodes>100||depth>8)throw Error('Message structure exceeds preview limits.');
  // Named files, forwarded messages, HTML and external attachment bodies are never opened.
  const headers=Array.isArray(part.headers)?part.headers:[];
  if(part.filename||part.body?.attachmentId||part.mimeType==='message/rfc822'||headers.some(h=>h.name?.toLowerCase()==='content-disposition'&&/^attachment(?:;|$)/i.test(h.value?.trim()||'')))return;
  if(part.mimeType==='text/plain'&&typeof part.body?.data==='string'){
   const types=headers.filter(h=>h.name?.toLowerCase()==='content-type');if(types.length>1)throw Error('Ambiguous text encoding.');const charset=types[0]?.value?.match(/charset\s*=\s*"?([^;"\s]+)/i)?.[1]?.toLowerCase();if(charset&&!['utf-8','utf8','us-ascii','iso-8859-1','windows-1252'].includes(charset))throw Error('Unsupported message text encoding.');
   const data=part.body.data;if(!/^[A-Za-z0-9_-]*={0,2}$/.test(data)||data.length>90000)throw Error('Message text exceeds preview limits.');
   const decoded=Buffer.from(data,'base64url');bytes+=decoded.length;if(bytes>65536)throw Error('Message text exceeds preview limits.');
   let text;try{text=new TextDecoder(!charset||charset==='utf8'||charset==='us-ascii'?'utf-8':charset,{fatal:true}).decode(decoded);}catch{throw Error('Message text encoding could not be verified.');}
   pieces.push(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,''));return;
  }
  if(part.mimeType?.startsWith('multipart/')){if(part.parts!==undefined&&!Array.isArray(part.parts))throw Error('Message parts are invalid.');for(const child of part.parts||[])visit(child,depth+1);}
 }
 visit(payload,0);return {text:pieces.join('\n\n'),plainTextAvailable:pieces.some(x=>x.trim().length>0)};
}
async function boundedJson(response){
 const reader=response.body?.getReader?.();if(!reader)throw Error('Bounded message response required.');const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>2*1024*1024){await reader.cancel();throw Error();}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Message response exceeded limits or could not be verified.');}finally{reader.releaseLock();}
}
export async function readOneGmailTextPreview({approved,ownerId,connectionId,grant,accessToken,savedMessage,confirmCurrent},fetcher=fetch){
 if(approved!==true||![ownerId,connectionId].every(x=>UUID.test(x||''))||grant?.ownerId!==ownerId||grant.connectionId!==connectionId||grant.provider!=='gmail'||!grant.scopes?.includes(GMAIL_READ_SCOPE)||typeof confirmCurrent!=='function')throw Error('Explicit message-content approval and verified owner required.');
 const saved=savedMessage;
 if(saved?.ownerId!==ownerId||saved.connectionId!==connectionId||saved.provider!=='gmail'||saved.visibility!=='private'||!saved.labelIds?.includes('INBOX')||typeof saved.messageId!=='string'||!/^[A-Za-z0-9_-]{1,256}$/.test(saved.messageId)||typeof accessToken!=='string'||!accessToken||/[\s\u007f]/.test(accessToken))throw Error('Verified saved Inbox message required.');
 if(!await confirmCurrent())throw Error('App session or saved selection changed.');
 const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(saved.messageId));url.searchParams.set('format','full');url.searchParams.set('fields','id,threadId,internalDate,labelIds,payload');
 let response;try{response=await fetcher(url.href,{method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch(error){throw Object.assign(Error('Message preview unavailable.'),{safeReason:['TimeoutError','AbortError'].includes(error.name)?'network-timeout':'network-unavailable'});}
 if(!response.ok)throw Object.assign(Error('Message preview unavailable.'),{safeReason:[401,403,404,429].includes(response.status)?'http-'+response.status:'provider-error'});const source=await boundedJson(response),metadata=normalizeGmailMetadata(source,{ownerId,connectionId});
 if(metadata.messageId!==saved.messageId||metadata.receivedAt!==saved.receivedAt||metadata.subject!==saved.subject||metadata.sender!==saved.sender||!metadata.labelIds.includes('INBOX')||metadata.labelIds.some(x=>['TRASH','SPAM','DRAFT'].includes(x)))throw Error('Message identity or Inbox membership changed.');
 const content=plainTextFromGmail(source.payload);if(!await confirmCurrent())throw Error('App session or saved selection changed.');
 const candidates=suggestGmailMessageCategories({subject:metadata.subject,text:content.text});
 return {previewOnly:true,persisted:false,provider:'gmail',subject:metadata.subject,sender:metadata.sender,receivedAt:metadata.receivedAt,...content,candidates,automaticActions:false};
}
