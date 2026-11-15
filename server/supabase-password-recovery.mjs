import {validatePublicDevConfig} from '../src/dev-api.mjs';
const emailValue=v=>typeof v==='string'&&v.length<=320&&/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(v)&&v===v.trim();
export function recoveryEmail(value){if(!emailValue(value))throw Error('Enter a valid email address.');return value.toLowerCase();}
// No configuration loading or network activity at construction. Only public project keys.
export function createSupabasePasswordRecovery(config,fetcher=fetch,{now=Date.now,timeoutMs=15000}={}){
 const {origin,key}=validatePublicDevConfig(config);
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Recovery transport configuration is invalid.');
 async function request(path,method,body,token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetcher(origin+'/auth/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json',Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('Recovery request could not be completed.');if(response.status===204)return null;const text=await response.text();if(text.length>65536)throw Error('Recovery response could not be verified.');return text?JSON.parse(text):null;}catch{throw Error('Recovery request could not be completed.');}finally{clearTimeout(timer);}}
 function access(token){if(typeof token!=='string'||!token||token.length>16384||/[\r\n\0]/.test(token))throw Error('A verified recovery session is required.');return token;}
 return{
  async sendRecoveryCode(email){await request('recover','POST',{email:recoveryEmail(email)});},
  async verifyRecoveryCode(email,code){email=recoveryEmail(email);if(typeof code!=='string'||!/^\d{6,10}$/.test(code))throw Error('Enter the emailed recovery code.');let candidate;try{const data=await request('verify','POST',{email,token:code,type:'recovery'});candidate=access(data?.access_token);if(!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error();const user=await request('user','GET',null,candidate);if(!user||!emailValue(user.email)||user.email.toLowerCase()!==email||!user.email_confirmed_at||!user.id)throw Error();return{accessToken:candidate,expiresAt:now()+Math.min(data.expires_in*1000,180000),user:{id:user.id,email:user.email.toLowerCase()}};}catch{if(candidate)try{await request('logout?scope=local','POST',null,candidate);}catch{}throw Error('Recovery code could not be verified.');}},
  async setRecoveryPassword(token,password){access(token);if(typeof password!=='string'||password.length<12||password.length>128||password.includes('\0'))throw Error('Use a password of 12–128 characters.');await request('user','PUT',{password},token);},
  async closeRecoverySession(token,{global=false}={}){access(token);if(typeof global!=='boolean')throw Error('Explicit session closing scope required.');await request('logout?scope='+ (global?'global':'local'),'POST',null,token);}
 };
}
