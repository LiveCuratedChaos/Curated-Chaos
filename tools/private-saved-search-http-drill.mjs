// In-process browser-request transport for the explicitly approved one-shortcut drill.
// It reuses the two already verified temporary logins; it never opens a listening port.
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
export async function createSavedSearchHttpDrill({base,scopedApi,config,sessions,actors,run}){
 const origin='http://127.0.0.1:5313',browsers=new Map(),reviews=new Map();let disposed=false;
 const denied=async()=>{throw Error('This drill cannot access existing app records.');};
 const api={...base,...scopedApi,listPrivateBriefRecords:async()=>[],getPrivateTask:denied,getPrivateTaskDetails:denied,addFictionalTask:denied,updatePrivateTask:denied,completePrivateTask:denied,reopenPrivateTask:denied,
  signIn:async(email,password)=>{const i=config.users.findIndex(u=>u.email===email&&u.password===password);if(i<0||i>1)throw Error('Known temporary development login required.');return sessions[i];}};
 const router=createPrivateSessionHttp({origin,api,cookieName:'cc_workspace_staging',allowBriefRead:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskEdit:true,allowTaskDescriptionEdit:true,allowTaskCompletion:true,allowTaskReopen:true,allowSavedSearches:true,savedSearchIdFactory:()=>run});
 async function call(contextId,path,values){if(disposed)throw Error('Drill transport closed.');const b=browsers.get(contextId);if(!b)throw Error('Unknown drill browser.');const req={url:'/auth/workspace/'+path,method:values===undefined?'GET':'POST',headers:{host:'127.0.0.1:5313',origin,cookie:b.cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':b.csrf},async *[Symbol.asyncIterator](){yield JSON.stringify(values);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};await router.handle(req,res);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])b.cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)b.csrf=data.csrf;if(res.status!==200)throw Error('Saved-search browser request was rejected.');return data;}
 const contextFor=actor=>{const i=actors.findIndex(a=>a.ownerId===actor.ownerId&&a.accessToken===actor.accessToken);if(i<0)throw Error('Unknown drill actor.');return i===0?'a':'b';};
 try{for(let i=0;i<2;i++){const id=i===0?'a':'b';browsers.set(id,{cookie:'',csrf:''});await call(id,'status');await call(id,'login',{email:config.users[i].email,password:config.users[i].password});}}
 catch(error){await router.dispose();throw error;}
 return{
  async offer(contextId,ownerId,filters){if(contextId!=='a'||ownerId!==actors[0].ownerId)throw Error('Known offer scope required.');const result=await call('a','search',filters);return{saveSearchToken:result.saveSearchToken,saveSearchExpiresAt:result.saveSearchExpiresAt};},
  list:(_id,actor,_expires,values={})=>call(contextFor(actor),'saved-searches/list',values),
  load:(_id,actor,key)=>call(contextFor(actor),'saved-searches/load',{savedSearchToken:key}),
  async prepare(_id,actor,values){const contextId=contextFor(actor),view=await call(contextId,'saved-searches/review',values);if(view.reviewId)reviews.set(view.reviewId,{contextId,ownerId:actor.ownerId});return view;},
  claim(contextId,ownerId,reviewId){const r=reviews.get(reviewId);if(!r||r.contextId!==contextId||r.ownerId!==ownerId)throw Error('Unknown browser review.');return{contextId,ownerId,reviewId,authorized:false};},
  async authorize(claim,actor){if(contextFor(actor)!==claim.contextId||actor.ownerId!==claim.ownerId)return false;claim.authorized=true;return true;},
  save:(claim,actor)=>{if(contextFor(actor)!==claim.contextId)throw Error('Unknown browser claim.');return call(claim.contextId,'saved-searches/save',{reviewId:claim.reviewId,approved:claim.authorized});},
  async dispose(){if(disposed)return;disposed=true;await router.dispose();}
 };
}
