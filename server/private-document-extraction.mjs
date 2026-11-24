import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DOCUMENT_LIMIT,DOCUMENT_TYPES} from '../src/private-document-fields.mjs';

const script=fileURLToPath(new URL('../native/documents/read-text.js',import.meta.url));
let active=0;
export async function extractDocumentPages(bytes,{platform=process.platform,mime='application/pdf',recognize=false}={}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>DOCUMENT_LIMIT||!DOCUMENT_TYPES.includes(mime)||typeof recognize!=='boolean'||
    mime==='application/pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')return {status:'unreadable'};
 if(platform!=='darwin')return {status:'unavailable'};
 if(active>=2)return {status:'busy'};
 active++;
 try{
  return await new Promise(resolve=>{
   const worker=spawn('/usr/bin/osascript',['-l','JavaScript',script,mime==='application/pdf'?'pdf':'image',recognize?'recognize':'text'],{stdio:['pipe','pipe','ignore'],env:{LANG:'en_US.UTF-8'}});
   const chunks=[];let length=0,closed=false;
   function done(result){if(closed)return;closed=true;clearTimeout(timer);resolve(result);}
   const timer=setTimeout(()=>{worker.kill('SIGKILL');},recognize?30000:15000);timer.unref?.();
   worker.on('error',()=>done({status:'unavailable'}));
   worker.stdin.on('error',()=>{});worker.stdin.end(bytes);
   worker.stdout.on('data',chunk=>{length+=chunk.length;if(length>1400000){worker.kill('SIGKILL');return;}chunks.push(chunk);});
   worker.on('close',code=>{
    try{
     if(code!==0||length>1400000)throw Error();
     const value=JSON.parse(Buffer.concat(chunks).toString());
     if(value.status==='unavailable'){done({status:'unavailable'});return;}
     if(value.status!=='ready'||!Array.isArray(value.methods)||!Array.isArray(value.pages)||value.methods.length!==value.pages.length||value.methods.some(m=>!['text','ocr','unavailable'].includes(m))||value.pages.length<1||value.pages.length>80||
        value.pages.some(s=>typeof s!=='string'||s.length>24000)||value.pages.reduce((n,s)=>n+s.length,0)>200000)throw Error();
     done({status:'ready',pages:value.pages,methods:value.methods});
    }catch{done({status:'unreadable'});}
   });
  });
 }finally{active--;}
}
