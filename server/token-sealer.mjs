// Server-only encryption primitive; keys come from secret storage, never the browser.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function createTokenSealer(key){
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('A 32-byte server encryption key is required.');
 const secret=Buffer.from(key);
 function seal(value,context){
  if(typeof context!=='string'||!context.length)throw Error('Token encryption context is required.');
  const plaintext=Buffer.from(JSON.stringify(value));if(plaintext.length>65536)throw Error('Token data exceeds the storage limit.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(context));
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:encrypted.toString('base64url')});
 }
 function unseal(envelope,context){
  try{
   if(typeof envelope!=='string'||envelope.length>90000||typeof context!=='string'||!context)throw Error();
   const value=JSON.parse(envelope);if(value.v!==1||typeof value.iv!=='string'||typeof value.tag!=='string'||typeof value.data!=='string')throw Error();
   const iv=Buffer.from(value.iv,'base64url'),tag=Buffer.from(value.tag,'base64url');if(iv.length!==12||tag.length!==16)throw Error();
   const decipher=createDecipheriv('aes-256-gcm',secret,iv);decipher.setAAD(Buffer.from(context));decipher.setAuthTag(tag);
   return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64url')),decipher.final()]).toString('utf8'));
  }catch{throw Error('Stored authorization could not be verified. Reconnect to continue.');}
 }
 return {seal,unseal};
}
