import {createPasswordRecoveryHttp} from './private-password-recovery-http.mjs';
import {createHttpsWorkspaceTransport,exactHttpsOrigin} from './https-workspace-transport.mjs';
import {createPrivateSessionHttp} from './private-workspace-session-http.mjs';
import {privateSessionCss,privateSessionScript} from './private-workspace-session-ui.mjs';
const innerOrigin='http://127.0.0.1:5312',innerCookie='cc_workspace_staging';
const readPaths=new Set(['/auth/workspace/','/auth/workspace/ui.css','/auth/workspace/ui.mjs','/auth/workspace/status','/auth/workspace/check']);
const writePaths=new Set(['/auth/workspace/login','/auth/workspace/logout']);
export const passwordSignInHtml=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Curated Chaos</title><link rel="stylesheet" href="/auth/workspace/ui.css"><main><p class="brand">CURATED CHAOS</p><h1>Welcome back</h1><p class="deck">Sign in with your email and password.</p><p id="status" role="status">Checking sign-in…</p><p id="error" role="alert" hidden></p><form id="login"><fieldset id="fields" disabled><legend>Sign in</legend><label>Email<input name="email" type="email" autocomplete="username" required maxlength="320"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="1024"></label><button type="submit">Sign in</button></fieldset></form><button id="logout" type="button" hidden>Sign out</button><button id="session-recheck" type="button">Recheck sign-in</button><p class="note">This separate sign-in preview does not open app records or connect email, calendars or banks. Account creation and password recovery are not enabled here.</p></main><script type="module" src="/auth/workspace/ui.mjs"></script></html>`;
// Candidate direct-TLS transport only. No listener, proxy trust, provider configuration or deployment.
export function createHttpsPasswordSessionPreview({origin,api,now=Date.now,allowPasswordRecovery=false,recoveryApi}={}){
 exactHttpsOrigin(origin);
 if(typeof now!=='function')throw Error('A server clock is required.');
 if(typeof allowPasswordRecovery!=='boolean'||Boolean(recoveryApi)!==allowPasswordRecovery)throw Error('Explicit password recovery API and scope required.');
 const recovery=allowPasswordRecovery?createPasswordRecoveryHttp({origin,api:recoveryApi,now}):null;
 const signInUi=recovery?passwordSignInHtml.replace('Account creation and password recovery are not enabled here.','Account creation is not enabled here. <a href="/auth/recovery/">Forgot your password?</a>'):passwordSignInHtml;
 const inner=createPrivateSessionHttp({origin:innerOrigin,api,now,cookieName:innerCookie,loginAttemptScope:'browser-context',ui:signInUi,css:privateSessionCss,script:privateSessionScript});
 return createHttpsWorkspaceTransport({origin,innerOrigin,cookieName:innerCookie,handleInner:inner.handle,disposeInner:inner.dispose,recovery,now,routeAllowed:(method,path)=>method==='GET'&&readPaths.has(path)||method==='POST'&&writePaths.has(path)});
}
