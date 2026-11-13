// Decode only after collecting a bounded request. UTF-8 characters can span chunks.
export async function readBoundedJsonBody(request,{maxBytes=4096,allowEmpty=false}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('A positive request byte limit is required.');
 const chunks=[];let size=0;
 for await(const chunk of request){
  if(typeof chunk!=='string'&&!(chunk instanceof Uint8Array))throw Error('Unsupported request chunk.');
  const bytes=Buffer.from(chunk);size+=bytes.length;
  if(size>maxBytes)throw Error('Request too large.');
  chunks.push(bytes);
 }
 const bytes=Buffer.concat(chunks,size),text=bytes.toString('utf8');
 if(!Buffer.from(text,'utf8').equals(bytes))throw Error('Request must use valid UTF-8.');
 return JSON.parse(text||(allowEmpty?'{}':''));
}
