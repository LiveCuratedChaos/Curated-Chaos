// Namespace-specific storage methods. Unused until explicitly called by the prepared service.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const origin='PRIVATE_COOKIE_SAVED_SEARCH';
const identity='id,owner_id,household_id,visibility,section,item_type,origin,version,deleted_at,created_at';
const sparse=identity+',saved_fictional:payload->fictional,saved_source:payload->source,saved_schema:payload->schemaVersion,saved_title:payload->title,saved_filters:payload->filters';
function rows(value,max=1){if(!Array.isArray(value)||value.length>max)throw Error('Saved-search response unverified.');return value;}
function path(owner,select='*'){if(!uuid(owner))throw Error('Verified saved-search owner required.');return '/rest/v1/cc_records?select='+select+'&owner_id=eq.'+owner+'&visibility=eq.private&household_id=is.null&section=eq.Personal%20Life&item_type=eq.saved_search&origin=eq.'+origin;}
function scoped(record,owner){if(!uuid(record?.id)||!uuid(owner)||record.owner_id!==owner||record.household_id!==null||record.visibility!=='private'||record.section!=='Personal Life'||record.item_type!=='saved_search'||record.origin!==origin)throw Error('Exact saved-search scope required.');}
function changePath(record,owner){scoped(record,owner);if(!Number.isInteger(record.version)||record.version<1||!(record.deleted_at===null||typeof record.deleted_at==='string'&&Number.isFinite(Date.parse(record.deleted_at))))throw Error('Reviewed saved-search version required.');return path(owner)+'&id=eq.'+record.id+'&version=eq.'+record.version+'&deleted_at='+(record.deleted_at===null?'is.null':'eq.'+encodeURIComponent(record.deleted_at));}
export function createPrivateSavedSearchApi(request){return{
 async getPrivateSavedSearch(token,id,owner){if(!uuid(id))throw Error('Verified saved-search identity required.');return rows(await request(path(owner)+'&id=eq.'+id+'&limit=2',{},token));},
 async listPrivateSavedSearches(token,owner,removed=false){
  if(typeof removed!=='boolean')throw Error('Explicit saved-search list scope required.');const result=[];let last='';
  for(;;){const page=rows(await request(path(owner,sparse)+'&deleted_at='+(removed?'not.is.null':'is.null')+'&order=id.asc&limit=100'+(last?'&id=gt.'+last:''),{},token),100);
   if(page.some((r,i)=>!uuid(r?.id)||r.id<=(i?page[i-1].id:last)))throw Error('Saved-search pagination unverified.');
   result.push(...page.map(({saved_fictional,saved_source,saved_schema,saved_title,saved_filters,...r})=>({...r,payload:{fictional:saved_fictional,source:saved_source,schemaVersion:saved_schema,title:saved_title,filters:saved_filters}})));
   if(result.length>2000)throw Error('Saved-search list exceeds its record limit.');if(page.length<100)return result;last=page.at(-1).id;
  }
 },
 async addPrivateSavedSearch(token,record){scoped(record,record?.owner_id);if(Object.keys(record).some(k=>!['id','owner_id','household_id','visibility','section','item_type','origin','payload'].includes(k)))throw Error('New saved-search fields required.');return rows(await request('/rest/v1/cc_records',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(record)},token));},
 async updatePrivateSavedSearch(token,record,owner,payload){const target=changePath(record,owner);if(record.deleted_at!==null||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Reviewed active saved search required.');return rows(await request(target,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload})},token));},
 async setPrivateSavedSearchDeletedAt(token,record,owner,deletedAt){const target=changePath(record,owner);if(!(deletedAt===null||typeof deletedAt==='string'&&Number.isFinite(Date.parse(deletedAt))&&new Date(deletedAt).toISOString()===deletedAt)||(record.deleted_at===null)===(deletedAt===null))throw Error('Reviewed saved-search removal or restoration required.');return rows(await request(target,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({deleted_at:deletedAt})},token));}
};}
