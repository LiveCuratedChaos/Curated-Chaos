// Direct-TLS full-workspace candidate. Inject an explicitly configured, unbound staging app.
// No configuration/credential loading, listener, proxy trust, provider grants or deployment.
import {createPasswordRecoveryHttp} from './private-password-recovery-http.mjs';
import {PRIVATE_WORKSPACE_ASSET_PATHS} from './private-workspace-static.mjs';
import {createHttpsWorkspaceTransport,exactHttpsOrigin} from './https-workspace-transport.mjs';
const getPaths=new Set(['/',...PRIVATE_WORKSPACE_ASSET_PATHS,'/dev-config.json','/auth/workspace/','/auth/workspace/ui.mjs','/auth/workspace/ui.css','/auth/workspace/status','/auth/workspace/check','/auth/workspace/brief','/auth/workspace/preferences']);
const actions=['widget-layout/history-list','widget-layout/history-read','widget-layout/read','widget-layout/review','widget-layout/save','widget-layout/cancel','tasks/history-manage','projects/history-manage','projects/history-list','projects/history-read','events/history-list','events/history-read','tasks/history-list','tasks/history-read','notes/history-list','notes/history-read','school/history-list','school/history-read','projects/tasks-source-manage','projects/tasks-source-read','common-tasks/begin','common-tasks/target-summary','common-tasks/source-read','common-tasks/source-manage','common-tasks/choose','common-tasks/select','common-tasks/review','common-tasks/save','common-tasks/cancel','school/academic-read','school/academic-review','school/identity-review','search/school-read','school/edit-read','school/edit-review','school/edit-save','school/edit-cancel','projects/references-list','projects/references-read','projects/references-manage','brief-week','school/overview','school/read','calendar-day/list','calendar-day/read','calendar-presentation/read','calendar-presentation/review','calendar-presentation/save','calendar-presentation/cancel','brief-layout/read','brief-layout/review','brief-layout/save','brief-layout/cancel','projects/overview','search/project-read','search/project-tasks','projects/references-tasks','projects/structure-list','projects/structure-review','projects/structure-save','projects/structure-cancel','projects/tasks-list','projects/tasks-review','projects/tasks-save','projects/tasks-cancel','projects/list','projects/read','projects/review','projects/save','projects/cancel','login','logout','search','calendar','brief-date','preferences/review','preferences/save','preferences/cancel','records/deleted','records/review','records/save','records/cancel','tasks/read','tasks/review','tasks/complete','tasks/cancel','tasks/edit-read','tasks/edit-review','tasks/edit-save','tasks/edit-cancel','tasks/create-review','tasks/create-save','tasks/create-cancel','notes/read','notes/review','notes/save','notes/cancel','notes/create-review','notes/create-save','notes/create-cancel','events/edit-read','events/edit-review','events/edit-save','events/edit-cancel','events/create-review','events/create-save','events/create-cancel','saved-searches/list','saved-searches/load','saved-searches/review','saved-searches/save','saved-searches/cancel'];
const postPaths=new Set(actions.map(path=>'/auth/workspace/'+path));
export function createHttpsPrivateWorkspacePreview({origin,application,now=Date.now,allowPasswordRecovery=false,recoveryApi}={}){
 exactHttpsOrigin(origin);
 if(typeof now!=='function')throw Error('A server clock is required.');
 if(typeof allowPasswordRecovery!=='boolean'||Boolean(recoveryApi)!==allowPasswordRecovery)throw Error('Explicit password recovery API and scope required.');
 if(application?.httpsBridge?.origin!=='http://127.0.0.1:5313'||application.httpsBridge.cookieName!=='cc_workspace_staging'||application.httpsBridge.sourcesEnabled!==false||application.server?.listening!==false||application.server.listenerCount('request')!==1||typeof application.dispose!=='function')throw Error('An unbound private staging application is required.');
 const handler=application.server.listeners('request')[0];
 const recovery=allowPasswordRecovery?createPasswordRecoveryHttp({origin,api:recoveryApi,now,signInPath:'/dev-dashboard.html'}):null;
 // Advertise only this explicitly enabled outer recovery service. The loopback app
 // keeps its own recovery disabled, so its development cookie is never exposed.
 const handleInner=async(req,res)=>{
  if(!recovery||req.url!=='/dev-config.json'||req.method!=='GET')return handler(req,res);
  let status,headers;
  const configResponse={writeHead(code,value){status=code;headers=value;return this;},end(body){
   if(status===200)body=JSON.stringify({...JSON.parse(body),privatePasswordRecovery:true});
   res.writeHead(status,headers);res.end(body);
  }};
  return handler(req,configResponse);
 };
 return createHttpsWorkspaceTransport({origin,innerOrigin:application.httpsBridge.origin,cookieName:application.httpsBridge.cookieName,now,handleInner,recovery,disposeInner:()=>application.dispose(),routeAllowed:(method,path)=>['GET','HEAD'].includes(method)&&getPaths.has(path)||method==='POST'&&postPaths.has(path)});
}
