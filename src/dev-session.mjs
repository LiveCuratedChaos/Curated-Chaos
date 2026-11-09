// M0E: TEST-ONLY in-tab session persistence for isolated Supabase accounts.
// sessionStorage retains a refresh token across reloads, NOT passwords or access JWTs.
// Not acceptable for production use with real/sensitive data; browser JS can read these tokens.
const MAX_AGE_MS=12*60*60*1000;
const SKEW_MS=60*1000;
const PREFIX='cc_m0e_dev_session_';
const validId=id=>typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function storageKey(ref){
  if(typeof ref!=='string' || !/^[a-z0-9-]{10,32}$/.test(ref)) throw Error('Invalid development project reference.');
  return PREFIX+ref;
}
export function createDevSessionManager(api, projectRef, storage, now=()=>Date.now()){
  const key=storageKey(projectRef);
  let state=null,generation=0,refreshing=null,restoring=null;
  const remove=()=>{try{storage?.removeItem(key);}catch{/* Storage may be disabled. */}};
  const read=()=>{try{return storage?.getItem(key)||null;}catch{return null;}};
  const save=()=>{
    if(!state)return false;
    const data={v:1,ref:projectRef,userId:state.user.id,refreshToken:state.token.refreshToken,issuedAt:state.issuedAt};
    try{storage?.setItem(key,JSON.stringify(data));return !!storage;}catch{return false;}
  };
  const notify=(user=null)=>{
    // Development UI only: notify the shared theme loader after verified auth.
    if(typeof window==='undefined'||typeof window.dispatchEvent!=='function')return;
    window.dispatchEvent(new CustomEvent('cc-dev-session',{detail:user?{
      ownerId:user.id,
      readPreferences:async()=>api.listBriefPreferences(await getAccessToken(),user.id)
    }:null}));
  };
  const clear=()=>{generation++;state=null;refreshing=null;restoring=null;remove();notify();};
  const get=()=>state?{user:state.user,expiresAt:state.token.expiresAt}:null;
  const validToken=candidate=>typeof candidate?.accessToken==='string'&&candidate.accessToken.length>0&&!/[\s\u007f]/.test(candidate.accessToken)&&typeof candidate.refreshToken==='string'&&candidate.refreshToken.length>0&&Number.isFinite(candidate.expiresAt)&&candidate.expiresAt>now();
  const verify=async(candidate,expectedId)=>{
    if(!validToken(candidate))throw Error('Session token verification failed.');
    const user=await api.getUser(candidate.accessToken);
    if(!validToken(candidate))throw Error('Session expired during verification.');
    if(!validId(user?.id)|| !user?.email || (expectedId && user.id!==expectedId))throw Error('Session user verification failed.');
    return user;
  };
  async function signIn(email,password){
    clear();const seq=generation;
    try{
      const candidate=await api.signIn(email,password);
      if(seq!==generation)throw Error('Sign-in was cancelled.');
      const user=await verify(candidate);
      if(seq!==generation)throw Error('Sign-in was cancelled.');
      state={token:candidate,user,issuedAt:now()};
      const stored=save();notify(user);return {user,stored};
    }catch(err){if(seq===generation)clear();throw err;}
  }
  async function restore(){
    if(state){notify(state.user);return get();}
    if(restoring)return restoring;
    const raw=read();if(!raw){notify();return null;}
    const seq=generation;
    const pending=(async()=>{
      try{
        const saved=JSON.parse(raw);
        if(saved?.v!==1 || saved.ref!==projectRef || !validId(saved.userId) ||
            typeof saved.refreshToken!=='string' || saved.refreshToken.length<8 ||
            !Number.isFinite(saved.issuedAt) || saved.issuedAt>now()+60000 ||
            now()-saved.issuedAt>MAX_AGE_MS)throw Error('Stored session is invalid or too old.');
        const candidate=await api.refreshSession(saved.refreshToken);
        if(seq!==generation)return null;
        const user=await verify(candidate,saved.userId);
        if(seq!==generation)return null;
        if(now()-saved.issuedAt>=MAX_AGE_MS)throw Error('Stored session expired during verification.');
        state={token:candidate,user,issuedAt:saved.issuedAt};
        save();notify(user);return get();
      }catch{if(seq===generation)clear();return null;}
    })();
    restoring=pending;
    try{return await pending;}finally{if(restoring===pending)restoring=null;}
  }
  async function getAccessToken(){
    if(!state)throw Error('Please sign in.');
    if(now()-state.issuedAt>MAX_AGE_MS){clear();throw Error('Your development session ended after 12 hours. Sign in again.');}
    const seq=generation,previous=state;
    if(state.token.expiresAt-now()<SKEW_MS){
      if(!refreshing){
        const pending=(async()=>{
          try{
            const candidate=await api.refreshSession(previous.token.refreshToken);
            if(seq!==generation||state!==previous)throw Error('Session changed. Please sign in again.');
            const user=await verify(candidate,previous.user.id);
            if(seq!==generation||state!==previous)throw Error('Session changed. Please sign in again.');
            if(now()-previous.issuedAt>=MAX_AGE_MS)throw Error('Session expired during refresh.');
            state={...previous,token:candidate,user};save();return candidate.accessToken;
          }catch(err){
            if(seq===generation&&state===previous){clear();throw Error('Your development session expired. Please sign in again.');}
            throw Error('Session changed. Please sign in again.');
          }
        })();
        refreshing=pending;
      }
      const pending=refreshing;
      try{
        const token=await pending;
        if(seq!==generation)throw Error('Session changed. Please sign in again.');
        return token;
      }finally{if(refreshing===pending)refreshing=null;}
    }
    return state.token.accessToken;
  }
  async function signOut(){
    const token=state?.token.accessToken;
    clear();
    try{await api.signOut(token);}catch{/* Local data already cleared. */}
  }
  return {signIn,restore,getAccessToken,signOut,get,clear,storageKey:key};
}
