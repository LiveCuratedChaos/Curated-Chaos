// M2G private fictional Finances organization, no household sharing.
export const FINANCE_KINDS=Object.freeze(['budget','bill','account','investment']);
export function financeRecords(rows,owner){return Array.isArray(rows)?rows.filter(r=>r?.owner_id===owner&&r?.section==='Finances'&&r?.visibility==='private'&&r?.household_id===null&&r?.payload?.fictional===true&&r?.deleted_at==null&&['project','task'].includes(r.item_type)):[];}
export function financeKind(r){return FINANCE_KINDS.includes(r?.payload?.financeKind)?r.payload.financeKind:'budget';}
export function financeCreate(kind,title,owner,projectId=null){
 title=String(title||'').trim();if(!title||title.length>140)throw Error('Enter a name (1–140 characters).');
 if(!/^[0-9a-f-]{36}$/i.test(owner||''))throw Error('Development account required.');
 if(!FINANCE_KINDS.includes(kind)&&kind!=='step')throw Error('Unknown Finances item');
 const isStep=kind==='step';
 return {owner_id:owner,household_id:null,visibility:'private',section:'Finances',item_type:isStep?'task':'project',origin:'m2i-fictional',payload:{title,fictional:true,source:'M2I_FINANCE_QA',financeKind:isStep?'step':kind,status:isStep?'Not Started':'In Progress',done:false,project_id:isStep?projectId:null,subtasks:[],description:'',day:''}};
}
export function financeProgress(rows,projectId){const tasks=rows.filter(r=>r.item_type==='task'&&r.payload?.project_id===projectId);return {total:tasks.length,done:tasks.filter(t=>t.payload.done===true).length};}
