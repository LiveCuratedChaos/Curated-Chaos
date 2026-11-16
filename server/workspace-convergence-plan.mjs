// Offline inventory only. No transport, credentials, record conversion or writes.
// Existing fictional/private and first-party/manual provenance stays authoritative.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types=new Set(['project','task','project_task_link','project_project_link']);
const projectFields=new Set(['schemaVersion','source','fictional','title','summary','description','status','archived','separateRecurring']);
const taskFields=new Set(['schemaVersion','source','fictional','title','description','day','status','done','priority','project_id','subtasks','recurrence','recurrenceStopped']);
export function planWorkspaceConvergence({records,ownerId,complete=false}={}){
 if(!uuid.test(ownerId||'')||complete!==true||!Array.isArray(records)||records.length>2000)throw Error('Complete bounded owner-private inventory required.');
 const ids=new Set(),count={manualProjects:0,manualTasks:0,reviewedProjects:0,reviewedTasks:0,taskLinks:0,hierarchyLinks:0,unknownProvenance:0,extendedRecords:0,longDescriptions:0,recurringTasks:0,archivedProjects:0,progressPreferences:0,manualAssignments:0,extendedTaskStatuses:0};
 for(const r of records){if(!r||!uuid.test(r.id||'')||ids.has(r.id.toLowerCase())||r.owner_id!==ownerId||r.household_id!==null||r.visibility!=='private'||r.deleted_at!==null||!Number.isSafeInteger(r.version)||r.version<1||!types.has(r.item_type)||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload))throw Error('Inventory ownership, identity or scope unavailable.');ids.add(r.id.toLowerCase());
 const p=r.payload,manual=r.origin==='CC_MANUAL_WORKSPACE'&&p.schemaVersion===1&&p.source==='manual'&&p.fictional===false;
 const reviewed=p.fictional===true&&((r.item_type==='project'&&r.origin==='PRIVATE_COOKIE_PROJECT')||(r.item_type==='task'&&r.origin==='PRIVATE_COOKIE_TASK_CREATE')||(r.item_type==='project_task_link'&&r.origin==='PRIVATE_COOKIE_PROJECT_TASK_LINK')||(r.item_type==='project_project_link'&&r.origin==='PRIVATE_COOKIE_PROJECT_PROJECT_LINK'));
 if(!manual&&!reviewed){count.unknownProvenance++;continue;}
 if(r.item_type==='project'){count[manual?'manualProjects':'reviewedProjects']++;if(p.archived===true)count.archivedProjects++;if(Object.hasOwn(p,'separateRecurring'))count.progressPreferences++;if(Object.keys(p).some(k=>!projectFields.has(k)))count.extendedRecords++;if(typeof(p.description??p.summary)==='string'&&(p.description??p.summary).length>1000)count.longDescriptions++;}
 if(r.item_type==='task'){count[manual?'manualTasks':'reviewedTasks']++;if(p.recurrence!=null)count.recurringTasks++;if(p.project_id)count.manualAssignments++;if(p.status&&!['Not Started','Completed'].includes(p.status))count.extendedTaskStatuses++;if(typeof p.description==='string'&&p.description.length>1000)count.longDescriptions++;if(Object.keys(p).some(k=>!taskFields.has(k))||(Array.isArray(p.subtasks)&&p.subtasks.some(s=>s&&Object.keys(s).some(k=>!['id','title','done'].includes(k)))))count.extendedRecords++;}
 if(r.item_type==='project_task_link')count.taskLinks++;
 if(r.item_type==='project_project_link')count.hierarchyLinks++;
 }
 const required=['explicit identity/provenance mapping','version-preserving history and idempotent receipts','atomic reviewed migration preview and rollback','all original payload fields retained'];
 if(count.taskLinks||count.manualAssignments)required.push('canonical many-project task membership, not a single project_id overwrite');
 if(count.hierarchyLinks)required.push('several-parent hierarchy, cycle rejection and distinct-task rollups');
 if(count.progressPreferences)required.push('per-project repeating-progress preference');
 if(count.recurringTasks)required.push('recurrence identity/history and successor membership');
 if(count.archivedProjects)required.push('archive visibility without deleting relationships');
 if(count.longDescriptions)required.push('preserve descriptions beyond the manual editor limit');
 if(count.extendedTaskStatuses)required.push('retain task status beyond binary completion');
 if(count.extendedRecords)required.push('explicit extension compatibility without dropping unknown fields');
 if(count.unknownProvenance)required.push('review unsupported provenance without relabeling it as manual');
 return {planOnly:true,automaticConversionAllowed:false,recordWrites:0,domainValidationPerformed:false,counts:count,requiredContracts:required};
}
