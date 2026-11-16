import {randomBytes} from 'node:crypto';
import {privateProjectState} from './private-projects.mjs';
const summary=row=>({title:row.payload.title,section:row.section,day:row.payload.day??'',projectStatus:row.payload.status,archived:row.payload.archived===true});
export function createPrivateProjectReader({api,now=Date.now}){
 const states=new Map();let disposed=false;
 function clear(id){clearTimeout(states.get(id)?.timer);states.delete(id);}
 const current=(id,token)=>Boolean(!disposed&&states.get(id)?.expiresAt>now()&&states.get(id).actions.has(token));
 function begin(id,ownerId,expiresAt){clear(id);if(disposed||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Current project search required.');const state={ownerId,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map()};states.set(id,state);state.timer=setTimeout(()=>clear(id),state.expiresAt-now());state.timer.unref?.();
  return row=>{privateProjectState(row,ownerId,{summary:true});if(states.get(id)!==state||state.expiresAt<=now()||state.actions.size>=50)throw Error('Project search ended.');const token=randomBytes(32).toString('base64url');state.actions.set(token,{id:row.id,version:row.version,...summary(row)});return{projectReadToken:token};};
 }
 async function read(id,actor,token){const state=states.get(id),selected=state?.actions.get(token),live=()=>current(id,token)&&states.get(id)===state;if(!live()||!selected||state.ownerId!==actor.ownerId)throw Error('Fetch latest before opening this project.');const rows=await api.getPrivateProject(actor.accessToken,selected.id,actor.ownerId);if(!live()||!Array.isArray(rows)||rows.length!==1)throw Error('Project details unavailable.');const row=privateProjectState(rows[0],actor.ownerId),actual=summary(row);if(row.id!==selected.id||row.version!==selected.version||Object.keys(actual).some(k=>actual[k]!==selected[k]))throw Error('Project changed after search. Fetch latest.');return{...actual,description:row.payload.description,readOnly:true,expiresAt:state.expiresAt};}
 return{begin,read,current,clear,dispose(){disposed=true;for(const id of states.keys())clear(id);}};
}
