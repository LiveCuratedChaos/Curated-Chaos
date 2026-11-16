// Explicit private hierarchy transport. No provider access or automatic writes.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function createPrivateProjectHierarchyApi(request){
 if(typeof request!=='function')throw Error('Private project hierarchy transport required.');
 return{
  async projectHierarchySnapshot(token,owner){
   if(!uuid(owner))throw Error('Verified hierarchy owner required.');
   const value=await request('/rest/v1/rpc/cc_project_hierarchy_snapshot',{method:'POST',body:'{}'},token);
   if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='memberships,projects,relationships,tasks'||Object.values(value).some(rows=>!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r?.id)).size!==rows.length||rows.some(r=>!uuid(r?.id)||r.owner_id!==owner||r.household_id!==null||r.visibility!=='private')))throw Error('Complete private project hierarchy unavailable.');
   return value;
  },
  async setProjectHierarchyLink(token,v){
   if(!v||Object.keys(v).sort().join(',')!=='childProjectId,childVersion,linkVersion,linked,parentProjectId,parentVersion'||![v.parentProjectId,v.childProjectId].every(uuid)||v.parentProjectId===v.childProjectId||![v.parentVersion,v.childVersion].every(n=>Number.isInteger(n)&&n>0)||!Number.isInteger(v.linkVersion)||v.linkVersion<0||typeof v.linked!=='boolean')throw Error('Exact reviewed project relationship required.');
   const value=await request('/rest/v1/rpc/cc_set_project_hierarchy_link',{method:'POST',body:JSON.stringify({p_parent_project_id:v.parentProjectId,p_parent_version:v.parentVersion,p_child_project_id:v.childProjectId,p_child_version:v.childVersion,p_link_version:v.linkVersion,p_linked:v.linked})},token);
   if(!value||Array.isArray(value))throw Error('Project relationship save unconfirmed.');return value;
  }
 };
}
