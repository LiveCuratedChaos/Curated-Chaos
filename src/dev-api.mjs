// Isolated development API: never stores sessions in cookies, sessionStorage, localStorage or files.
// NEVER put real personal information, bank details or provider keys in the test records.
export function validatePublicDevConfig(c){
  if(!c || typeof c!=='object') throw Error('Development configuration missing.');
  const u=new URL(c.supabaseUrl||'');
  if(u.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) || u.pathname!=='/' || u.search || u.hash || c.projectRef!==u.hostname.split('.')[0] || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey||'')) throw Error('Invalid isolated Supabase project configuration.');
  return {origin:u.origin,ref:c.projectRef,key:c.publishableKey};
}
export function makeFictionalNote(title,body,ownerId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId||'')) throw Error('Verified account required.');
  title=String(title||'').trim(); body=String(body||'').trim();
  if(title.length<1||title.length>120 || body.length>1000) throw Error('Enter a title (1–120 characters) and optional description (up to 1000 characters).');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',origin:'manual-test',payload:{title,body,fictional:true,source:'M0C_DEV_LOGIN_TEST'}};
}
export function createDevApi(config,fetcher=fetch){
  const {origin,key}=validatePublicDevConfig(config);
  async function request(path,options={},token){
    const headers={'apikey':key,'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':`Bearer ${token}`}:{})};
    let response;
    try {response=await fetcher(origin+path,{...options,headers:{...headers,...(options.headers||{})},cache:'no-store',redirect:'error'});}
    catch {throw Error('Could not reach the isolated development Supabase project. Check your connection.');}
    let data;
    const raw=await response.text();
    try {data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!response.ok){
      const detail=String(data?.msg||data?.message||data?.error_description||'Request failed').slice(0,160);
      throw Error(`Supabase HTTP ${response.status}: ${detail}`);
    }
    return data;
  }
  return {
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
    listNotes(token){return request('/rest/v1/cc_records?select=id,owner_id,section,item_type,payload,created_at&visibility=eq.private&item_type=eq.note&order=created_at.desc&limit=50',{},token);},
    addNote(token,note){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(note)},token);},
    listBriefRecords(token){return request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at&visibility=eq.private&item_type=in.(task,note,event)&order=created_at.desc&limit=200',{},token);},
    addFictionalTask(token,task){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(task)},token);},
    addFictionalEvent(token,event){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(event)},token);},
    listFictionalEmails(token){return request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at&visibility=eq.private&item_type=eq.email_fixture&order=created_at.desc&limit=100',{},token);},
    addFictionalEmail(token,email){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(email)},token);},
    listFictionalLife(token){return request('/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at&visibility=eq.private&item_type=in.(school_fixture,bill_fixture,household_fixture)&order=created_at.asc&limit=100',{},token);},
    addFictionalLife(token,entry){return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(entry)},token);},
    listBriefPreferences(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required for preferences.');
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,version&visibility=eq.private&owner_id=eq.${encodeURIComponent(ownerId)}&item_type=eq.brief_preferences&order=updated_at.desc&limit=30`,{},token);
    },
    addBriefPreferences(token,entry){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(entry)},token);
    },
    updateBriefPreferences(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1)throw Error('Invalid saved preference revision.');
      const query=`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.brief_preferences&version=eq.${record.version}`;
      return request(query,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listWidgetLayouts(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at,updated_at,version&visibility=eq.private&owner_id=eq.${encodeURIComponent(ownerId)}&item_type=eq.dashboard_layout&order=updated_at.desc&limit=20`,{},token);
    },
    addWidgetLayout(token,record){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateWidgetLayout(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1)throw Error('Invalid widget layout revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.dashboard_layout&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listOrganization(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,deleted_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&deleted_at=is.null&item_type=in.(task,project)&order=created_at.desc&limit=250`,{},token);
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
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,origin,payload,created_at,updated_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA&order=created_at.asc&limit=150`,{},token);
    },
    addSchoolCourse(token,record){
      if(record?.item_type!=='school_fixture'||record?.origin!=='M2E_SCHOOL_QA'||record?.household_id!==null||record?.visibility!=='private'||record?.payload?.fictional!==true)throw Error('Invalid private practice course.');
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(record)},token);
    },
    updateSchoolCourse(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')||!/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1||payload?.fictional!==true||payload.source!=='M2E_SCHOOL_QA')throw Error('Invalid school course revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listCalendarRecords(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,deleted_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&deleted_at=is.null&item_type=in.(event,task)&order=created_at.desc&limit=750`,{},token);
    },
    updateCalendarEvent(token,record,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')|| !/^[0-9a-f-]{36}$/i.test(record?.id||'')||!Number.isInteger(record?.version)||record.version<1||payload?.fictional!==true)throw Error('Invalid fictional calendar event revision.');
      return request(`/rest/v1/cc_records?id=eq.${encodeURIComponent(record.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.event&version=eq.${record.version}`,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    listCalendarPreferences(token,ownerId){
      if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))throw Error('Verified test account required.');
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,version&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.calendar_preferences&order=updated_at.desc&limit=20`,{},token);
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
      return request(`/rest/v1/cc_records?select=id,owner_id,household_id,visibility,item_type,payload,created_at&visibility=eq.private&owner_id=eq.${encodeURIComponent(ownerId)}&item_type=eq.suggestion_decision&order=created_at.desc&limit=100`,{},token);
    },
    addSuggestionDecision(token,decision){
      return request('/rest/v1/cc_records',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(decision)},token);
    },
    toggleFictionalTask(token,recordId,ownerId,payload){
      if(!/^[0-9a-f-]{36}$/i.test(recordId)|| !/^[0-9a-f-]{36}$/i.test(ownerId))throw Error('Invalid test record ID.');
      const query=`/rest/v1/cc_records?id=eq.${encodeURIComponent(recordId)}&owner_id=eq.${encodeURIComponent(ownerId)}&visibility=eq.private&item_type=eq.task`;
      return request(query,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({payload})},token);
    },
    async signOut(token){if(token)try{await request('/auth/v1/logout',{method:'POST'},token);}catch{/* Local session still cleared. */}}
  };
}
