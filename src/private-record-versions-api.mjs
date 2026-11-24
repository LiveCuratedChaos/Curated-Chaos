// Selected history uses the authenticated server adapter; never call from a browser view.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createPrivateRecordVersionsApi(request){
 if(typeof request!=='function')throw Error('Protected history transport required.');
 return{
  async isPrivateSavedSearchVersionsReady(token){const value=await request('/rest/v1/rpc/cc_private_saved_search_versions_ready',{method:'POST',body:'{}'},token);if(typeof value!=='boolean')throw Error('Shortcut history protection response unverified.');return value;},
  async isPrivateRecordVersionsReady(token){const value=await request('/rest/v1/rpc/cc_private_record_versions_ready',{method:'POST',body:'{}'},token);if(typeof value!=='boolean')throw Error('Record history protection response unverified.');return value;},
  listPrivateRecordVersions(token,id,offset=0){if(!uuid(id)||!Number.isInteger(offset)||offset<0||offset>999950||offset%50)throw Error('Bounded selected history required.');return request('/rest/v1/rpc/list_private_record_versions',{method:'POST',body:JSON.stringify({p_record_id:id,p_offset:offset})},token);},
  getPrivateRecordVersion(token,id,versionId){if(!uuid(id)||!uuid(versionId))throw Error('Exact selected history required.');return request('/rest/v1/rpc/get_private_record_version',{method:'POST',body:JSON.stringify({p_record_id:id,p_version_id:versionId})},token);}
 };
}
