// Same-origin cookie transport; no browser token/key storage and no write retries.
export function createProjectWorkspaceClient({fetcher=fetch,onSessionEnded=()=>{}}={}) {
  let csrf='',generation=0,closed=false,ownerId=null;
  async function call(path,method='GET',body) {
    if(closed)throw Error('Workspace session ended.');const ticket=generation;
    const response=await fetcher('/api/workspace/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{...(method==='POST'?{'Content-Type':'application/json','X-CC-CSRF':csrf}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(closed||ticket!==generation)throw Error('Workspace session changed.');
    if(response.status===401){clear();onSessionEnded();throw Error('Sign in again.');}
    const data=await response.json();
    if(closed||ticket!==generation)throw Error('Workspace session changed.');
    if(!response.ok)throw Error('Workspace request could not be confirmed.');
    if(!data||typeof data!=='object'||['accessToken','refreshToken','sessionId','password'].some(k=>Object.hasOwn(data,k)))throw Error('Unexpected workspace response.');
    return data;
  }
  function clear(){closed=true;generation++;csrf='';ownerId=null;}
  return Object.freeze({
    async status(){const data=await call('session');if(typeof data.csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.csrf)||data.signedIn!==true||typeof data.user?.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(data.user.id))throw Error('Verified session required.');if(ownerId&&ownerId!==data.user.id){clear();onSessionEnded();throw Error('Workspace account changed.');}ownerId=data.user.id;csrf=data.csrf;return data;},
    list:()=>call('projects/list'),create:body=>call('projects/create','POST',body),update:body=>call('projects/update','POST',body),
    undo:body=>call('projects/undo','POST',body),history:body=>call('projects/history','POST',body),
    async signOut(){try{return await call('logout','POST',{});}finally{clear();onSessionEnded();}},clear
  });
}
