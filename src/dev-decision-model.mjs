// M1E: fictional owner-private, append-only *QA decision history*.
// This is NOT an immutable/transactional audit log; the existing prototype table has no uniqueness guarantee.
import { makeSuggestionDismissal } from './dev-intelligence-model.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function makeApprovalDecision(suggestion,ownerId,task){
  const verified=makeSuggestionDismissal(suggestion,ownerId);
  if(!task||!UUID.test(task.id||'')||task.owner_id!==ownerId||task.visibility!=='private'||task.household_id!==null||task.item_type!=='task'||task.payload?.fictional!==true||task.payload?.source!=='M1A_APPROVED_'+suggestion.id) throw Error('Only a confirmed, owner-private saved fictional task can be approved.');
  const title=String(task.payload.title||'');
  if(!title||title.length>140)throw Error('Approved task title is invalid.');
  return {...verified,origin:'M1E_APPROVAL_QA',payload:{...verified.payload,status:'approved',task_id:task.id,task_title:title}};
}
export function makeRestoreDecision(suggestion,ownerId){
  const verified=makeSuggestionDismissal(suggestion,ownerId);
  return {...verified,origin:'M1E_RESTORE_QA',payload:{...verified.payload,status:'restored'}};
}
export function getDecisionState(rows,ownerId,suggestions){
  const allowed=new Map((Array.isArray(suggestions)?suggestions:[]).filter(s=>s&&typeof s.id==='string'&&typeof s.source==='string').map(s=>[s.id,s]));
  const valid=(Array.isArray(rows)?rows:[]).filter(r=>{
    const p=r?.payload,s=allowed.get(p?.suggestion_id);
    return r.owner_id===ownerId && r.visibility==='private' && r.item_type==='suggestion_decision' && p?.fictional===true && s && p.source===s.source &&
      ['approved','dismissed','restored'].includes(p.status) && (p.status!=='approved'||UUID.test(p.task_id||''));
  }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id||'').localeCompare(String(a.id||'')));
  const latest=new Map();
  for(const row of valid){if(!latest.has(row.payload.suggestion_id))latest.set(row.payload.suggestion_id,row);}
  const approved=new Set(),dismissed=new Set();
  for(const [id,row] of latest){if(row.payload.status==='approved')approved.add(id);if(row.payload.status==='dismissed')dismissed.add(id);}
  return {latest,approved,dismissed,history:valid};
}

// A restored dismissal is a historical decision, NOT an active block.
// Only the latest effective approval or dismissal prevents a new approval.
export function decisionPreventsApproval(state, suggestionId){
  return Boolean(state?.approved?.has(suggestionId) || state?.dismissed?.has(suggestionId));
}
