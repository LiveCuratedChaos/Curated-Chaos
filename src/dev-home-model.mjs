// M2G private fictional Home & Household organization, no household sharing.
export const HOME_KINDS=Object.freeze(['cleaning','grocery','maintenance','delivery']);
export function homeRecords(rows,owner){return Array.isArray(rows)?rows.filter(r=>r?.owner_id===owner&&r?.section==='Home'&&r?.visibility==='private'&&r?.household_id===null&&r?.payload?.fictional===true&&r?.deleted_at==null&&['project','task'].includes(r.item_type)):[];}
export function homeKind(r){return HOME_KINDS.includes(r?.payload?.homeKind)?r.payload.homeKind:'cleaning';}
export function homeCreate(kind,title,owner,projectId=null){
 title=String(title||'').trim();if(!title||title.length>140)throw Error('Enter a name (1–140 characters).');
 if(!/^[0-9a-f-]{36}$/i.test(owner||''))throw Error('Development account required.');
 if(!HOME_KINDS.includes(kind)&&kind!=='step')throw Error('Unknown Home item');
 const isStep=kind==='step';
 return {owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:isStep?'task':'project',origin:'m2h-fictional',payload:{title,fictional:true,source:'M2H_HOME_QA',homeKind:isStep?'step':kind,status:isStep?'Not Started':'In Progress',done:false,project_id:isStep?projectId:null,subtasks:[],description:'',day:''}};
}
export function homeProgress(rows,projectId){const tasks=rows.filter(r=>r.item_type==='task'&&r.payload?.project_id===projectId);return {total:tasks.length,done:tasks.filter(t=>t.payload.done===true).length};}
