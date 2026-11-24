import {projectNoteIds} from './private-project-note-fields.mjs';
import {projectFields} from './private-project-model.mjs';
import {privateCareerFields} from './private-career-fields.mjs';
import {readHomeAsset} from './private-home-asset.mjs';
// Explicit project-only API. List projection excludes project descriptions.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function path(owner,select='*'){if(!uuid(owner))throw Error('Verified project owner required.');return '/rest/v1/cc_records?select='+select+'&owner_id=eq.'+owner+'&visibility=eq.private&household_id=is.null&item_type=eq.project&origin=eq.PRIVATE_COOKIE_PROJECT&deleted_at=is.null';}
function validFields(r){const p=r?.payload;if(!p||p.fictional!==true||p.schemaVersion!==1||Object.keys(p).filter(k=>!['separateRecurring','career','homeAsset','noteIds'].includes(k)).sort().join(',')!=='description,fictional,schemaVersion,status,title')throw Error('Supported project fields required.');projectNoteIds(r);const fields=projectFields({title:p.title,description:p.description,status:p.status,section:r.section,...(Object.hasOwn(p,'separateRecurring')?{separateRecurring:p.separateRecurring}:{}),...(Object.hasOwn(p,'career')?{career:p.career}:{}),...(Object.hasOwn(p,'homeAsset')?{homeAsset:p.homeAsset}:{})});if(fields.title!==p.title||Object.hasOwn(p,'career')&&(!privateCareerFields(p.career,{requireCanonical:true})||r.section!=='Work')||Object.hasOwn(p,'homeAsset')&&(!readHomeAsset(p.homeAsset)||r.section!=='Home'))throw Error('Canonical project fields required.');}
// Select only display fields for the Home widget. Notes and earlier readings stay in the editor.
const assetFields = {
 asset_kind:'kind', asset_year:'year', asset_make:'make', asset_model:'model', asset_unit:'usageUnit',
 asset_warranty:'warrantyEndDay', asset_day:'usageEntries->-1->day', asset_value:'usageEntries->-1->value'
};
const assetColumns = Object.entries(assetFields).map(([alias, field]) => alias + ':payload->homeAsset->' + field).join(',');
function projectListRow(raw, homeSummary) {
 const {project_title:title, project_status:status, project_schema:schemaVersion, project_fictional:fictional, ...row} = raw;
 for (const alias of Object.keys(assetFields)) delete row[alias];
 if (homeSummary && row.section === 'Home' && raw.asset_kind != null) {
  row.homeAssetSummary = {
   kind:raw.asset_kind, label:[raw.asset_year, raw.asset_make, raw.asset_model].filter(Boolean).join(' '),
   usageUnit:raw.asset_unit, warrantyEndDay:raw.asset_warranty,
   latestUsageDay:raw.asset_day ?? '', latestUsageValue:raw.asset_value ?? null
  };
 }
 return {...row,payload:{title,status,schemaVersion,fictional}};
}
export function createPrivateProjectApi(request){if(typeof request!=='function')throw Error('Project transport required.');return{
 async getPrivateProject(token,id,owner){if(!uuid(id))throw Error('Exact project identity required.');const rows=await request(path(owner)+'&id=eq.'+id+'&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Project response unavailable.');return rows;},
 async listPrivateProjects(token,owner,{homeSummary=false,applications=false,careerGoals=false}={}){const result=[];let last='';for(;;){const rows=await request(path(owner,'id,owner_id,household_id,visibility,section,item_type,origin,version,deleted_at,created_at,updated_at,project_title:payload->title,project_status:payload->status,project_schema:payload->schemaVersion,project_fictional:payload->fictional'+(homeSummary?','+assetColumns:'')+
 (careerGoals?',goal_role:payload->career->role,goal_skills:payload->career->skills,goal_certifications:payload->career->certifications':'')+
 (applications?',application_employer:payload->career->employer,application_role:payload->career->role,application_stage:payload->career->stage':''))+
 (careerGoals?'&section=eq.Work&payload->career->>kind=eq.goal':'')+
 (applications?'&section=eq.Work&payload->career->>kind=eq.application':'')+'&order=id.asc&limit=100'+(last?'&id=gt.'+last:''),{},token);if(!Array.isArray(rows)||rows.length>100||rows.some((r,i)=>!uuid(r.id)||r.id<=(i?rows[i-1].id:last)))throw Error('Project pagination unavailable.');result.push(...rows.map(raw=>{
  if(careerGoals){
   const {goal_role:role,goal_skills:skills,goal_certifications:certifications,...row}=raw;
   return {...projectListRow(row,false),goal:{role,skills,certifications}};
  }
  if(!applications)return projectListRow(raw,homeSummary);
  const {application_employer:employer,application_role:role,application_stage:stage,...row}=raw;
  return {...projectListRow(row,false),application:{employer,role,stage}};
 }));if(result.length>2000)throw Error('Project list exceeds its limit.');if(rows.length<100)return result;last=rows.at(-1).id;}},
 addPrivateProject(token,record){if(!uuid(record?.id)||!uuid(record.owner_id)||record.household_id!==null||record.visibility!=='private'||record.item_type!=='project'||record.origin!=='PRIVATE_COOKIE_PROJECT'||Object.keys(record).some(k=>!['id','owner_id','household_id','visibility','section','item_type','origin','payload'].includes(k)))throw Error('Exact new private project required.');validFields(record);return request('/rest/v1/cc_records',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(record)},token);},
 updatePrivateProject(token,record,owner,proposed){if(!uuid(record?.id)||record.owner_id!==owner||record.visibility!=='private'||record.household_id!==null||record.item_type!=='project'||record.origin!=='PRIVATE_COOKIE_PROJECT'||record.deleted_at!==null||!Number.isInteger(record.version)||record.version<1||proposed?.id!==record.id||proposed.owner_id!==owner||proposed.item_type!=='project'||proposed.origin!==record.origin||proposed.visibility!=='private'||proposed.household_id!==null)throw Error('Reviewed project version required.');validFields(proposed);return request(path(owner)+'&id=eq.'+record.id+'&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload:proposed.payload,section:proposed.section})},token);}
};}
