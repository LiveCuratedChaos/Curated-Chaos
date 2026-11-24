import {privateSavedMail} from './private-saved-mail.mjs';
import {careerFold} from '../src/private-career-pipeline.mjs';

// Match only an explicit stage heading and the selected employer and role.
// A forwarded subject or a similar employer/role must not advance an application.
const stages=new Map([
 ['application received','Applied'],['interview invitation','Interviewing'],
 ['interview scheduled','Interviewing'],['job offer','Offer received']
]);
const fold=value=>careerFold(value).replace(/\s+/gu,' ').trim();
export function stageFromSubject(subject,career){
 if(typeof subject!=='string'||/[\u0000-\u001f\u007f]/u.test(subject)||career?.kind!=='application')return null;
 const heading=subject.match(/^([^:–—]+?)\s*(?::| – | — | - )\s*(.+)$/u);
 if(!heading)return null;
 const stage=stages.get(fold(heading[1]));
 if(!stage||fold(stage)===fold(career.stage))return null;
 const role=fold(career.role),employer=fold(career.employer),target=fold(heading[2]);
 if(!role||!employer)return null;
 const labels=[role+' at '+employer,employer+' - '+role,employer+' – '+role,employer+' — '+role,role+' - '+employer,role+' – '+employer,role+' — '+employer];
 return labels.includes(target)?stage:null;
}
export async function applicationMailPage(api,actor,record,offset,now,expiresAt){
 if(!Number.isInteger(offset)||offset<0||offset>495||offset%5)throw Error('Choose a saved email page.');
 const rows=await api.listSavedMailMetadata(actor.accessToken,actor.ownerId,{offset});
 const view=privateSavedMail(rows,actor.ownerId,{now,expiresAt,offset});
 const matches=rows.slice(0,5).flatMap(row=>{
  const stage=stageFromSubject(row.subject,record.payload.career);
  return stage?[{id:row.id,subject:row.subject,receivedAt:new Date(row.received_at).toISOString(),savedAt:new Date(row.created_at).toISOString(),stage}]:[];
 });
 return {matches,offset,hasMore:view.hasMore,browseLimitReached:view.browseLimitReached};
}
export const mailEvidence=({subject,receivedAt,stage})=>({subject,receivedAt,stage});
