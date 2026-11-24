import {createPrivateRecordVersionsApi} from './private-record-versions-api.mjs';
import {createPrivateCommonTaskLinkApi} from './private-common-task-link-api.mjs';
import {createPrivateSchoolRecordsApi} from './private-school-records-api.mjs';
import {createPrivateSchoolEditApi} from './private-school-edit-api.mjs';
import {createPrivateSchoolStudyApi} from './private-school-study-api.mjs';
import {createAcademicCalendarApi} from './private-academic-calendar-api.mjs';
import {createPrivateSchoolReadApi} from './private-school-read-api.mjs';
import {createPrivateProjectHierarchyApi} from './private-project-hierarchy-api.mjs';
import {createPrivateProjectTaskLinkApi} from './private-project-task-link-api.mjs';
import {createProjectNoteApi} from './private-project-note-api.mjs';
import {createPrivateProjectApi} from './private-project-api.mjs';
import {createPrivateRecurringChoreApi} from './private-recurring-chore-api.mjs';
import {createPrivateSavedSearchApi} from './private-saved-search-api.mjs';
import {createPrivateListTemplateApi} from './private-list-template-api.mjs';
// Isolated development API: never stores sessions in cookies, sessionStorage, localStorage or files.
// NEVER put real personal information, bank details or provider keys in the test records.
export function validatePublicDevConfig(c){
  if(!c || typeof c!=='object') throw Error('Development configuration missing.');
  const u=new URL(c.supabaseUrl||'');
  if(u.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) || u.pathname!=='/' || u.username || u.password || u.port || u.search || u.hash || c.projectRef!==u.hostname.split('.')[0] || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey||'')) throw Error('Invalid isolated Supabase project configuration.');
  return {origin:u.origin,ref:c.projectRef,key:c.publishableKey};
}
export function makeFictionalNote(title,body,ownerId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId||'')) throw Error('Verified account required.');
  title=String(title||'').trim(); body=String(body||'').trim();
  if(title.length<1||title.length>120 || body.length>1000) throw Error('Enter a title (1–120 characters) and optional description (up to 1000 characters).');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',origin:'manual-test',payload:{title,body,fictional:true,source:'M0C_DEV_LOGIN_TEST'}};
}
export function createDevApi(config,fetcher=fetch,{timeoutMs=15000,includeAllDay=false,includeEventEndDay=false,includeTaskPriority=false,includeTaskPriorityLists=false,includeHomeCleaning=false,includeHomeGroceries=false,includeHomeDeliveries=false,documentStorage=null,manualFinanceStorage=null,includeRecurringChores=false,includeRoutineStreaks=false,includeProjects=false,includeListTemplates=false,includeProjectTaskLinks=false,includeProjectHierarchy=false,includeCommonTaskLinks=false,includeRecordVersions=false}={}){
  if(typeof includeRecordVersions!=='boolean')throw Error('Explicit record history adapter scope required.');if(typeof includeListTemplates!=='boolean')throw Error('Explicit list-template adapter scope required.');
  if(typeof includeCommonTaskLinks!=='boolean'||includeCommonTaskLinks&&(!includeProjects||!includeProjectTaskLinks))throw Error('Explicit canonical task membership scope required.');
  if(typeof includeProjectHierarchy!=='boolean'||includeProjectHierarchy&&(!includeProjects||!includeProjectTaskLinks))throw Error('Explicit hierarchy and membership scope required.');
  if(typeof includeProjectTaskLinks!=='boolean'||includeProjectTaskLinks&&!includeProjects)throw Error('Explicit project membership scope required.');if(typeof includeProjects!=='boolean')throw Error('Explicit project scope required.');if(typeof includeRecurringChores!=='boolean')throw Error('Explicit recurring chore scope required.');if(typeof includeTaskPriorityLists!=='boolean'||typeof includeHomeCleaning!=='boolean'||typeof includeHomeGroceries!=='boolean'||typeof includeHomeDeliveries!=='boolean')throw Error('Explicit task priority list projection required.');if(typeof includeTaskPriority!=='boolean')throw Error('Explicit task priority projection required.');if(typeof includeAllDay!=='boolean'||typeof includeEventEndDay!=='boolean')throw Error('Explicit all-day projection required.');if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('Invalid development request timeout.');
  const {origin,key}=validatePublicDevConfig(config);
  async function request(path,options={},token){
    const headers={'apikey':key,'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':`Bearer ${token}`}:{})};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
    let response;
    try {response=await fetcher(origin+path,{...options,headers:{...headers,...(options.headers||{})},cache:'no-store',redirect:'error',signal:controller.signal});}
    catch {throw Error('Could not reach the isolated development Supabase project. Check your connection.');}
    let data;
    const raw=await response.text();
    try {data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!response.ok){
      const detail=String(data?.msg||data?.message||data?.error_description||'Request failed').slice(0,160);
      throw Error(`Supabase HTTP ${response.status}: ${detail}`);
    }
    return data;
    }catch(error){if(controller.signal.aborted)throw Error('Development request timed out. A save may have reached the server; refresh and check before retrying.');throw error;}finally{clearTimeout(timer);}
  }
  // Fetch bounded pages in a stable order; never present a partial list as complete.
  async function listAll(path,token){
    const query=path.replace(/limit=\d+/, 'limit=100').replace(/order=([^&]+)/, 'order=$1,id.asc');
    const rows=[];
    for(let offset=0;;){
      const page=await request(query+'&offset='+offset,{},token);
      if(!Array.isArray(page))throw Error('Cloud list could not be verified.');
      rows.push(...page);
      if(page.length<100)return rows;
      offset+=page.length;
      if(offset>=100000)throw Error('Too many records to load safely. No partial list was applied.');
    }
  }
  const recoverySelect='id,owner_id,household_id,visibility,section,item_type,version,deleted_at,recovery_fictional:payload->fictional,recovery_title:payload->title'+(includeProjects?',origin,recovery_schema:payload->schemaVersion':'');
  const recoveryUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function recoveryPath(ownerId){if(!recoveryUuid(ownerId))throw Error('Verified recovery owner required.');return '/rest/v1/cc_records?select='+recoverySelect+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&item_type=in.(task,note,event'+(includeProjects?',project':'')+')';}
  function recoveryRows(rows,max=1){if(!Array.isArray(rows)||rows.length>max)throw Error('Sparse recovery response unverified.');return rows.map(({recovery_fictional,recovery_title,recovery_schema,...row})=>({...row,payload:{fictional:recovery_fictional,title:recovery_title,...(includeProjects&&row.item_type==='project'?{schemaVersion:recovery_schema}:{})}}));}
  return {
    ...(includeRecordVersions?createPrivateRecordVersionsApi(request):{}),
    ...(includeListTemplates?createPrivateListTemplateApi(request,{includeHome:includeHomeGroceries}):{}),
    ...createPrivateSchoolReadApi(request),
    ...createAcademicCalendarApi(request),
    ...createPrivateSchoolStudyApi(request),
    applyPrivateSchoolGuideChange:(token,id,version,docVersion,change)=>request('/rest/v1/rpc/cc_apply_private_school_guide_change',
      {method:'POST',body:JSON.stringify({p_record:id,p_version:version,p_document_version:docVersion,p_change:change})},token),
    appendPrivateSchoolGuide:(token,recordId,version,documentVersion,guide)=>request('/rest/v1/rpc/cc_append_private_school_guide',
      {method:'POST',body:JSON.stringify({p_record:recordId,p_version:version,p_document_version:documentVersion,p_guide:guide})},token),
    ...createPrivateSchoolEditApi(request),
    ...createPrivateSchoolRecordsApi(request),
    ...(includeCommonTaskLinks?createPrivateCommonTaskLinkApi(request):{}),...(includeProjectHierarchy?createPrivateProjectHierarchyApi(request):{}),...(documentStorage?{documentStorage:documentStorage(request)}:{}),...(manualFinanceStorage?manualFinanceStorage(request):{}),...(includeProjects?{...createPrivateProjectApi(request),...createProjectNoteApi(request)}:{}),...(includeProjectTaskLinks?createPrivateProjectTaskLinkApi(request):{}),
    ...(includeRecurringChores?createPrivateRecurringChoreApi(request,{allowCommonMemberships:includeCommonTaskLinks}):{}),
    ...createPrivateSavedSearchApi(request),
    async getPrivateRecordState(token,id,ownerId){if(!recoveryUuid(id))throw Error('Verified recovery item required.');return recoveryRows(await request(recoveryPath(ownerId)+'&id=eq.'+encodeURIComponent(id)+'&limit=2',{},token));},
    async listPrivateDeletedRecords(token,ownerId,since){if(typeof since!=='string'||!Number.isFinite(Date.parse(since))||new Date(since).toISOString()!==since)throw Error('Exact recovery cutoff required.');const rows=[];let last='';for(;;){const page=recoveryRows(await request(recoveryPath(ownerId)+'&deleted_at=gte.'+encodeURIComponent(since)+'&order=id.asc&limit=100'+(last?'&id=gt.'+encodeURIComponent(last):''),{},token),100);if(page.some((row,i)=>typeof row.id!=='string'||row.id<=(i?page[i-1].id:last)))throw Error('Recovery pagination unverified.');rows.push(...page);if(rows.length>2000)throw Error('Recovery list exceeds its record limit.');if(page.length<100)return rows;last=page.at(-1).id;}},
    async setPrivateRecordDeletedAt(token,record,ownerId,deletedAt){
      if(!recoveryUuid(record?.id)||record.owner_id!==ownerId||record.visibility!=='private'||record.household_id!==null||!['task','note','event',...(includeProjects?['project']:[])].includes(record.item_type)||!Number.isInteger(record.version)||record.version<1||!(record.deleted_at===null||typeof record.deleted_at==='string'&&Number.isFinite(Date.parse(record.deleted_at)))||!(deletedAt===null||typeof deletedAt==='string'&&Number.isFinite(Date.parse(deletedAt))&&new Date(deletedAt).toISOString()===deletedAt)||(record.deleted_at===null)===(deletedAt===null))throw Error('Reviewed removal or restoration required.');
      if(record.item_type==='project'&&(record.origin!=='PRIVATE_COOKIE_PROJECT'||record.payload?.fictional!==true||record.payload.schemaVersion!==1||typeof record.payload.title!=='string'||record.payload.title!==record.payload.title.trim()||!record.payload.title||record.payload.title.length>140||/[\u0000-\u001f\u007f]/.test(record.payload.title)||!['Home','Personal Life','Work','School'].includes(record.section)))throw Error('Exact private project recovery scope required.');
      const path=recoveryPath(ownerId)+'&id=eq.'+encodeURIComponent(record.id)+'&version=eq.'+record.version+'&item_type=eq.'+record.item_type+'&section=eq.'+encodeURIComponent(record.section)+'&deleted_at='+(record.deleted_at===null?'is.null':'eq.'+encodeURIComponent(record.deleted_at))+(record.item_type==='project'?'&origin=eq.PRIVATE_COOKIE_PROJECT&payload->>schemaVersion=eq.1&payload->>fictional=eq.true':'');
      return recoveryRows(await request(path,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({deleted_at:deletedAt})},token));
    },
    async signIn(email,password){
      const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
      if(!data?.access_token||!data?.expires_in)throw Error('No valid test session returned.');
      if(!data.refresh_token) throw Error('No session renewal token returned.');
      return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+data.expires_in*1000};
    },
    async refreshSession(refreshToken){
      if(!refreshToken || typeof refreshToken!=='string') throw Error('Missing refresh credentials.');
      const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refreshToken})});
      if(!data?.access_token || !data?.refresh_token || !Number.isFinite(data.expires_in) || data.expires_in<=0) throw Error('Session renewal did not return valid credentials.');
      return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+data.expires_in*1000};
    },
    getUser(token){return request('/auth/v1/user',{},token);},
    async isSessionActive(token){const active=await request('/rest/v1/rpc/cc_development_session_active',{method:'POST',body:'{}'},token);if(typeof active!=='boolean')throw Error('Development session status not verified.');return active;},
    signOutLocal(token){return request('/auth/v1/logout?scope=local',{method:'POST'},token);},
    ...(includeRoutineStreaks?{async listRoutineOccurrences(token,owner,series){
      if(!recoveryUuid(owner)||!recoveryUuid(series))throw Error('A saved routine is required.');
      const select='id,owner_id,household_id,visibility,deleted_at,section,item_type,version,fictional:payload->fictional,day:payload->day,done:payload->done,recurrence:payload->recurrence,recurrence_completion:payload->recurrence_completion,recurrence_predecessor:payload->recurrence_predecessor,recurrenceStopped:payload->recurrenceStopped';
      const path='/rest/v1/cc_records?select='+select+'&owner_id=eq.'+owner+'&household_id=is.null&visibility=eq.private&item_type=eq.task&payload->recurrence->>seriesId=eq.'+series+'&order=id.asc&limit=100';
      const rows=[];let cursor='';
      for(;;){
       const page=await request(path+(cursor?'&id=gt.'+cursor:''),{},token);
       if(!Array.isArray(page)||page.length>100||rows.length+page.length>2000||page.some((r,i)=>!recoveryUuid(r.id)||r.id<=(i?page[i-1].id:cursor)))throw Error('Complete routine history required.');
       rows.push(...page.map(({fictional,day,done,recurrence,recurrence_completion,recurrence_predecessor,recurrenceStopped,...row})=>({...row,payload:{fictional,day,done,recurrence,recurrence_completion,recurrence_predecessor,recurrenceStopped}})));
       if(page.length<100)return rows;
       cursor=page.at(-1).id;
      }
    }}:{}),
    async listSessionProbeRecords(token,ownerId){if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified development owner required.');const rows=await request('/rest/v1/cc_records?select=id,owner_id&owner_id=eq.'+encodeURIComponent(ownerId)+'&order=id.asc&limit=100',{},token);if(!Array.isArray(rows)||rows.length>100||rows.some(row=>row.owner_id!==ownerId||!row.id||Object.keys(row).some(key=>!['id','owner_id'].includes(key))))throw Error('Development access probe not verified.');return rows;},
    listNotes(token){return listAll('/rest/v1/cc_records?select=id,owner_id,section,item_type,payload,created_at&visibility=eq.private&item_type=eq.note&order=created_at.desc&limit=50',token);},
    addNote(token,note){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(note)},token);},
    listBriefRecords(token){return listAll('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,version&deleted_at=is.null&visibility=eq.private&item_type=in.(task,note,event)&order=created_at.desc&limit=200',token);},
    async listPrivateAppearance(token,ownerId,{allowAccessibleAppearance=false,allowCategoryColorPreferences=false}={}){if(typeof allowAccessibleAppearance!=='boolean'||typeof allowCategoryColorPreferences!=='boolean')throw Error('Explicit appearance display scope required.');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId||''))throw Error('Verified appearance owner required.');const rows=await request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,deleted_at,version,appearance_fictional:payload->fictional,appearance_source:payload->source,appearance_palette:payload->palette,appearance_density:payload->density'+(allowAccessibleAppearance?',appearance_text_size:payload->textSize,appearance_motion:payload->motion,appearance_sound:payload->completionSound,appearance_haptics:payload->completionHaptics':'')+(allowCategoryColorPreferences?',appearance_sections:payload->categoryColors->sections,appearance_items:payload->categoryColors->items':'')+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&household_id=is.null&visibility=eq.private&deleted_at=is.null&item_type=eq.brief_preferences&section=eq.Personal%20Life&limit=2',{},token);if(!Array.isArray(rows)||rows.length>2)throw Error('Private appearance response unverified.');return rows.map(({appearance_fictional,appearance_source,appearance_palette,appearance_density,appearance_text_size,appearance_motion,appearance_sound,appearance_haptics,appearance_sections,appearance_items,...row})=>({...row,payload:{fictional:appearance_fictional,source:appearance_source,palette:appearance_palette,density:appearance_density,...(allowAccessibleAppearance?{textSize:appearance_text_size,motion:appearance_motion,completionSound:appearance_sound,completionHaptics:appearance_haptics}:{}),...(allowCategoryColorPreferences?{categoryColors:{sections:appearance_sections??{},items:appearance_items??{}}}:{})}}));},
    async listSavedMailMetadata(token,ownerId,{offset=0}={}){if(!Number.isInteger(offset)||offset<0||offset>495||offset%5)throw Error('Bounded saved-mail page required.');if(!recoveryUuid(ownerId))throw Error('Verified saved-mail owner required.');const columns='id,owner_id,household_id,visibility,section,item_type,origin,deleted_at,created_at,provider:payload->>provider,fictional:payload->fictional,subject:payload->content->>subject,sender:payload->content->>sender,received_at:payload->content->>receivedAt';const rows=await request('/rest/v1/cc_records?select='+columns+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&section=eq.Personal%20Life&item_type=eq.provider_email&origin=eq.google_readonly&payload->>provider=eq.gmail&payload->>fictional=eq.false&order=created_at.desc,id.asc&limit=6&offset='+offset,{},token);if(!Array.isArray(rows)||rows.length>6)throw Error('Saved email metadata response unverified.');return rows;},
    async listWorkspaceConvergenceRecords(token,ownerId){
      if(!recoveryUuid(ownerId))throw Error('Verified convergence owner required.');const rows=[];
      for(let offset=0;offset<=2000;offset+=100){const page=await request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,version,deleted_at,payload,created_at,updated_at&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=in.(project,task,project_task_link,project_project_link,common_task_link)&order=id.asc&limit=100&offset='+offset,{},token);if(!Array.isArray(page)||page.length>100||rows.length+page.length>2000)throw Error('Complete bounded convergence inventory required.');rows.push(...page);if(page.length<100)return rows;}throw Error('Complete convergence inventory required.');
    },
    async listPrivateBriefRecords(token,ownerId){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId||''))throw Error('Verified workspace owner required.');
      const rows=[];let last='';for(;;){const path='/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,created_at,deleted_at,version,brief_fictional:payload->fictional,brief_title:payload->title,brief_day:payload->day,brief_done:payload->done,brief_time:payload->time,brief_end_time:payload->end_time'+(includeAllDay?',brief_all_day:payload->all_day':'')+(includeEventEndDay?',brief_end_day:payload->end_day':'')+(includeTaskPriorityLists?',brief_priority:payload->priority':'')+(includeHomeCleaning?',brief_home_cleaning:payload->homeCleaning':'')+(includeHomeGroceries?',brief_home_grocery:payload->homeGrocery':'')+(includeHomeDeliveries?',brief_home_delivery:payload->homeDelivery':'')+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=in.(task,note,event)&order=id.asc&limit=100'+(last?'&id=gt.'+encodeURIComponent(last):'');const page=await request(path,{},token);if(!Array.isArray(page)||page.length>100||page.some((row,i)=>typeof row.id!=='string'||row.id<=(i?page[i-1].id:last)))throw Error('Private brief pagination could not be verified.');rows.push(...page.map(row=>({id:row.id,owner_id:row.owner_id,household_id:row.household_id,visibility:row.visibility,section:row.section,item_type:row.item_type,created_at:row.created_at,deleted_at:row.deleted_at,version:row.version,payload:{fictional:row.brief_fictional,title:row.brief_title,day:row.brief_day,done:row.brief_done,time:row.brief_time,...(includeTaskPriorityLists&&row.item_type==='task'?{priority:row.brief_priority}:{}),...(includeHomeCleaning&&row.item_type==='task'&&row.brief_home_cleaning!==undefined?{homeCleaning:row.brief_home_cleaning}:{}),...(includeHomeDeliveries&&row.item_type==='task'&&row.section==='Home'&&row.brief_home_delivery!=null?{homeDelivery:row.brief_home_delivery}:{}),...(includeHomeGroceries&&row.item_type==='task'&&row.brief_home_grocery!==undefined?{homeGrocery:row.brief_home_grocery}:{}),...(includeEventEndDay&&row.item_type==='event'&&row.brief_end_day!=null?{end_day:row.brief_end_day}:{}),...(includeAllDay&&row.item_type==='event'&&row.brief_all_day===true?{all_day:true}:{}),...(row.item_type==='event'&&row.brief_end_time!=null?{end_time:row.brief_end_time}:{})}})));if(rows.length>2000)throw Error('Private brief exceeds its record limit.');if(page.length<100)return rows;last=page.at(-1).id;}
    },
    async getPrivateNote(token,id,ownerId){const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'');if(!uuid(id)||!uuid(ownerId))throw Error('Verified private note identity required.');const rows=await request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,deleted_at,version,note_fictional:payload->fictional,note_title:payload->title,note_body:payload->body&id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.note&section=eq.Personal%20Life&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Private note could not be verified.');return rows.map(({note_fictional,note_title,note_body,...row})=>({...row,payload:{fictional:note_fictional,title:note_title,body:note_body}}));},
    async getPrivateNoteForEdit(token,id,ownerId){if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified private note identity required.');const rows=await request('/rest/v1/cc_records?select=*&id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.note&section=eq.Personal%20Life&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Private note could not be verified.');return rows;},
    updatePrivateNote(token,record,ownerId,payload){if(!Number.isInteger(record?.version)||record.version<1||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Reviewed note edit required.');return request('/rest/v1/cc_records?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.note&section=eq.Personal%20Life&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload})},token);},
    async getPrivateTask(token,id,ownerId){if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified private task identity required.');const rows=await request('/rest/v1/cc_records?select=*&id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.task&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Private task could not be verified.');return rows;},
    async getPrivateTaskDetails(token,id,ownerId){if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified private task identity required.');const rows=await request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,deleted_at,version,task_fictional:payload->fictional,task_title:payload->title,task_day:payload->day,task_done:payload->done,task_description:payload->description,task_subtasks:payload->subtasks'+(includeTaskPriority?',task_priority:payload->priority':'')+(includeHomeCleaning?',task_home_cleaning:payload->homeCleaning':'')+(includeHomeGroceries?',task_home_grocery:payload->homeGrocery':'')+(includeHomeDeliveries?',task_home_delivery:payload->homeDelivery':'')+'&id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.task&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Private task could not be verified.');return rows.map(({task_fictional,task_title,task_day,task_done,task_description,task_subtasks,task_priority,task_home_cleaning,task_home_grocery,task_home_delivery,...row})=>({...row,payload:{fictional:task_fictional,title:task_title,day:task_day,done:task_done,description:task_description,subtasks:task_subtasks,...(includeTaskPriority?{priority:task_priority}:{}),...(includeHomeCleaning&&task_home_cleaning!==undefined?{homeCleaning:task_home_cleaning}:{}),...(includeHomeDeliveries&&row.section==='Home'&&task_home_delivery!=null?{homeDelivery:task_home_delivery}:{}),...(includeHomeGroceries&&task_home_grocery!==undefined?{homeGrocery:task_home_grocery}:{})}}));},
    async getPrivateEvent(token,id,ownerId){if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified private event identity required.');const rows=await request('/rest/v1/cc_records?select=*&id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.event&section=eq.Calendar&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('Private event could not be verified.');return rows;},
    updatePrivateTask(token,record,ownerId,payload,section){if(!Number.isInteger(record?.version)||record.version<1||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||'')||!['Home','Personal Life','Work','School'].includes(section))throw Error('Reviewed private task edit required.');return request('/rest/v1/cc_records?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.task&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload,section})},token);},
    updatePrivateEvent(token,record,ownerId,payload){if(!Number.isInteger(record?.version)||record.version<1||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Reviewed private event edit required.');return request('/rest/v1/cc_records?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.event&section=eq.Calendar&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload})},token);},
    completePrivateTask(token,record,ownerId,payload){if(payload?.done!==true||!Number.isInteger(record?.version)||record.version<1||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Reviewed task completion required.');return request('/rest/v1/cc_records?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.task&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload})},token);},
    reopenPrivateTask(token,record,ownerId,payload){if(payload?.done!==false||record?.payload?.done!==true||!Number.isInteger(record?.version)||record.version<1||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Reviewed task reopening required.');return request('/rest/v1/cc_records?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+encodeURIComponent(ownerId)+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.task&version=eq.'+record.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload})},token);},
    addFictionalTask(token,task){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(task)},token);},
    addFictionalEvent(token,event){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(event)},token);},
    listFictionalEmails(token){return listAll('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,version,deleted_at,payload,created_at&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.email_fixture&order=created_at.desc&limit=100',token);},
    addFictionalEmail(token,email){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(email)},token);},
    listFictionalLife(token){return listAll('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,version,deleted_at,payload,created_at&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=in.(school_fixture,bill_fixture,household_fixture)&order=created_at.asc&limit=100',token);},
    addFictionalLife(token,entry){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(entry)},token);},
    listBriefPreferences(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required for preferences.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at,updated_at,version,deleted_at&visibility=eq.private&household_id=is.null&deleted_at=is.null&owner_id=eq.${encodeURIComponent(ownerId)}&item_type=eq.brief_preferences&order=updated_at.desc&limit=30`,token);
    },
    addBriefPreferences(token,entry){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(entry)},token);
    },
    updateBriefPreferences(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1)throw Error('Invalid saved preference revision.');
      const query=`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.brief_preferences&version=eq.${record.version}`;
      return request(query,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listWidgetLayouts(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at,updated_at,version,deleted_at&visibility=eq.private&household_id=is.null&deleted_at=is.null&owner_id=eq.${encodeURIComponent(ownerId)}&item_type=eq.dashboard_layout&order=updated_at.desc&limit=20`,token);
    },
    addWidgetLayout(token,record){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateWidgetLayout(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1)throw Error('Invalid widget layout revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.dashboard_layout&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload:{...(record.payload||{}),...payload}})},token);
    },
    setWidgetSourceAssociation(token,{associationId,recordId,itemType,layoutRecordId,layoutVersion,sourceVersion}){return request('/rest/v1/rpc/cc_set_widget_source_association',{method:'POST',body:JSON.stringify({p_association_id:associationId,p_record_id:recordId,p_item_type:itemType,p_layout_record_id:layoutRecordId,p_layout_version:layoutVersion,p_source_version:sourceVersion})},token);},
    resolveWidgetSourceAssociation(token,associationId){return request('/rest/v1/rpc/cc_resolve_widget_source_association',{method:'POST',body:JSON.stringify({p_association_id:associationId})},token);},
    listOrganization(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,deleted_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&deleted_at=is.null&item_type=in.(task,project)&order=created_at.desc&limit=250`,token);
    },
    addOrganizationRecord(token,record){
      if(!['task','project'].includes(record?.item_type) || record?.visibility!=='private' || record?.household_id!==null || record?.payload?.fictional!==true)throw Error('Invalid fictional organization record.');
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateOrganizationRecord(token,record,ownerId,type,payload,section){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'') || !/^[0-9a-f-]{36}$/i.test(record?.id||'') || !Number.isInteger(record?.version)||record.version<1 || !['task','project'].includes(type) || !['Home','Personal Life','Work','School','Finances'].includes(section) || payload?.fictional!==true)throw Error('Invalid fictional record revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.${type}&version=eq.${record.version}`,
        {method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload,section})},token);
    },
    listSchoolCourses(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at,updated_at,version,deleted_at&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&household_id=is.null&deleted_at=is.null&section=eq.School&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA&order=created_at.asc&limit=150`,token);
    },
    addSchoolCourse(token,record){
      if(['academicIdentityVersion','academicRecoveryVersion','removedAcademicRecords'].some(key=>Object.hasOwn(record?.payload??{},key)))throw Error('Academic identities and recovery require protected reviewed creation.');
      if(record?.item_type!=='school_fixture'||record?.origin!=='M2E_SCHOOL_QA'||record?.household_id!==null||record?.visibility!=='private'||record?.payload?.fictional!==true)throw Error('Invalid private practice course.');
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateSchoolCourse(token,record,ownerId,payload){
      if(['academicIdentityVersion','academicRecoveryVersion','removedAcademicRecords'].some(key=>Object.hasOwn(record?.payload??{},key)||Object.hasOwn(payload??{},key)))throw Error('Use the protected School editor to preserve academic identities and recovery.');
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1||payload?.fictional!==true||payload.source!=='M2E_SCHOOL_QA')throw Error('Invalid school course revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&household_id=is.null&deleted_at=is.null&section=eq.School&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listCalendarRecords(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,deleted_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&deleted_at=is.null&item_type=in.(event,task)&order=created_at.desc&limit=750`,token);
    },
    updateCalendarEvent(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1||payload?.fictional!==true)throw Error('Invalid fictional calendar event revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.event&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listCalendarPreferences(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.calendar_preferences&order=updated_at.desc&limit=20`,token);
    },
    addCalendarPreferences(token,record){
      if(record?.item_type!=='calendar_preferences'||record?.visibility!=='private'||record?.household_id!==null||record?.payload?.fictional!==true)throw Error('Invalid private calendar preference record.');
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateCalendarPreferences(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1||payload?.fictional!==true)throw Error('Invalid calendar preference revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.calendar_preferences&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listSuggestionDecisions(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')) throw Error('Verified account required for private suggestion decisions.');
      return listAll(`/rest/v1/cc_records?select=id,owner_id,household_id,deleted_at,visibility,item_type,payload,created_at&visibility=eq.private&owner_id=eq.${encodeURIComponent(ownerId)}&household_id=is.null&deleted_at=is.null&item_type=eq.suggestion_decision&order=created_at.desc&limit=100`,token);
    },
    approveFictionalSuggestion(token,{sourceId,expectedVersion,title,day,section}){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId||'')||!Number.isInteger(expectedVersion)||expectedVersion<1||typeof title!=='string'||!title.trim()||title.trim().length>140||!['Home','Personal Life','Work','School'].includes(section)||typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||day<'2000-01-01'||day>'2100-12-31')throw Error('Refresh the saved source and review valid task fields before approving.');
      return request('/rest/v1/rpc/cc_approve_fictional_suggestion',{method:'POST',body:JSON.stringify({p_source_id:sourceId,p_source_version:expectedVersion,p_title:title.trim(),p_day:day,p_section:section})},token);
    },
    addSuggestionDecision(token,decision){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(decision)},token);
    },
    toggleFictionalTask(token,recordId,ownerId,payload,version){
      if(!Number.isInteger(version)||version<1)throw Error('Fetch latest before updating this task.');
      if(!/^[0-9a-f-]{36}$/i.test(recordId)|| !/^[0-9a-f-]{36}$/i.test(ownerId))throw Error('Invalid test record ID.');
      const query=`/rest/v1/cc_records?id=eq.${encodeURIComponent(recordId)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&deleted_at=is.null&item_type=eq.task&version=eq.${version}`;
      return request(query,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    async signOut(token){if(token)try{await request('/auth/v1/logout',{method:'POST'},token);}catch{/* Local session still cleared. */}}
  };
}
