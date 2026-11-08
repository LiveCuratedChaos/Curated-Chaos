// M2G private fictional Personal Life organization, no household sharing.
export const PERSONAL_KINDS=Object.freeze(['project','goal','list','routine']);
export function personalRecords(rows,owner){return Array.isArray(rows)?rows.filter(r=>r?.owner_id===owner&&r?.section==='Personal Life'&&r?.visibility==='private'&&r?.household_id===null&&r?.payload?.fictional===true&&r?.deleted_at==null&&['project','task'].includes(r.item_type)):[];}
export function personalKind(r){return PERSONAL_KINDS.includes(r?.payload?.personalKind)?r.payload.personalKind:'project';}
export function personalCreate(kind,title,owner,projectId=null){
 title=String(title||'').trim();if(!title||title.length>140)throw Error('Enter a name (1–140 characters).');
 if(!/^[0-9a-f-]{36}$/i.test(owner||''))throw Error('Development account required.');
 if(!PERSONAL_KINDS.includes(kind)&&kind!=='step')throw Error('Unknown Personal item');
 const isStep=kind==='step';
 return {owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:isStep?'task':'project',origin:'m2g-fictional',payload:{title,fictional:true,source:'M2G_PERSONAL_QA',personalKind:isStep?'step':kind,status:isStep?'Not Started':'In Progress',done:false,project_id:isStep?projectId:null,subtasks:[],description:'',day:''}};
}
export function progressFor(rows,projectId){const tasks=rows.filter(r=>r.item_type==='task'&&r.payload?.project_id===projectId);return {total:tasks.length,done:tasks.filter(t=>t.payload.done===true).length};}
