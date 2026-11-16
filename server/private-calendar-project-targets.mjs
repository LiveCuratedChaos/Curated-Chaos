import {privateProjectState} from './private-projects.mjs';

// A transient Calendar projection, never a saved event or mutation authority.
export function calendarProjectTargets(rows,ownerId){
 if(!Array.isArray(rows)||rows.length>2000||new Set(rows.map(row=>row?.id)).size!==rows.length)throw Error('Complete private project targets required.');
 const projects=rows.map(row=>privateProjectState(row,ownerId,{summary:true}));
 return projects.filter(row=>row.payload.archived!==true&&Boolean(row.payload.day)).map(row=>({
  id:row.id,owner_id:row.owner_id,household_id:null,visibility:'private',section:'Calendar',item_type:'event',deleted_at:null,version:row.version,created_at:row.created_at,
  projectArea:row.section,payload:{fictional:true,title:row.payload.title,day:row.payload.day,time:'00:00',all_day:true}
 }));
}
