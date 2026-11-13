// Server-only manual workspace adapter. Actor ownerId must come from the verified
// session, never from browser fields. No retries after an uncertain write outcome.
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const failure = code => Object.assign(Error({PROJECT_WORKSPACE_INVALID:'Workspace request could not be verified.',PROJECT_WORKSPACE_CONFLICT:'Workspace changed. Reload before saving.',PROJECT_WORKSPACE_LIMIT:'Workspace exceeds this view’s supported limit.',PROJECT_WORKSPACE_UNAVAILABLE:'Workspace storage unavailable. Check the saved result before retrying.'}[code]),{code});
const fail = () => {throw failure('PROJECT_WORKSPACE_INVALID');};
function record(value,ownerId) {
 if(!value || !uuid(value.id) || value.owner_id!==ownerId || value.household_id!==null || value.visibility!=='private' || value.origin!=='CC_MANUAL_WORKSPACE' || !['project','task'].includes(value.item_type) || !['Home','Personal Life','Work','School'].includes(value.section) || !Number.isSafeInteger(value.version) || value.version<1 || value.payload?.schemaVersion!==1 || value.payload?.source!=='manual' || value.payload?.fictional!==false) fail();
 return value;
}
export function createProjectWorkspaceRepository({rpc,rpcTimeoutMs=5000}={}) {
 if(typeof rpc!=='function'||!Number.isInteger(rpcTimeoutMs)||rpcTimeoutMs<10||rpcTimeoutMs>10000)throw Error('Explicit server workspace RPC required.');
 async function call(operation,input) {
  if(!uuid(input.ownerId))fail();let timer;const controller=new AbortController();
  try {
   const result=await Promise.race([Promise.resolve().then(()=>rpc('cc_project_workspace',{operation,input},{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(failure('PROJECT_WORKSPACE_UNAVAILABLE'));},rpcTimeoutMs);})]);
   if(!result || result.error || !Object.hasOwn(result,'data')) {
    const code=result?.error?.message;
    throw failure(['PROJECT_WORKSPACE_INVALID','PROJECT_WORKSPACE_CONFLICT','PROJECT_WORKSPACE_LIMIT'].includes(code)?code:'PROJECT_WORKSPACE_UNAVAILABLE');
   }
   return result.data;
  } catch(error) {if(['PROJECT_WORKSPACE_INVALID','PROJECT_WORKSPACE_CONFLICT','PROJECT_WORKSPACE_LIMIT','PROJECT_WORKSPACE_UNAVAILABLE'].includes(error?.code))throw error;throw failure('PROJECT_WORKSPACE_UNAVAILABLE');}
  finally {clearTimeout(timer);controller.abort();}
 }
 async function mutation(operation,args) {
  if(!args||!uuid(args.operationId))fail();
  const value=await call(operation,args);
  if(!value||value.operationId!==args.operationId||typeof value.replayed!=='boolean')fail();
  record(value.record,args.ownerId);if(operation==='update'&&value.record.id!==args.id)fail();return value;
 }
 return Object.freeze({
  async list({ownerId}={}) {
   const rows=[],seen=new Set();let revision;
   for(let offset=0;offset<2000;offset+=50){
    const page=await call('list',{ownerId,offset,limit:50,...(revision===undefined?{}:{revision})});
    if(!page||!Array.isArray(page.rows)||page.rows.length>50||!Number.isSafeInteger(page.revision)||page.revision<0||typeof page.hasMore!=='boolean'||page.hasMore&&page.rows.length!==50)fail();
    if(revision!==undefined&&page.revision!==revision)throw failure('PROJECT_WORKSPACE_CONFLICT');revision=page.revision;
    for(const row of page.rows){record(row,ownerId);if(row.deleted_at!==null||seen.has(row.id))fail();seen.add(row.id);rows.push(row);}
    if(!page.hasMore)return rows;
   }
   throw failure('PROJECT_WORKSPACE_LIMIT');
  },
  async create(args={}) {if(!args.record||typeof args.record!=='object'||Array.isArray(args.record))fail();return mutation('create',args);},
  async update(args={}) {if(!uuid(args.id)||!Number.isSafeInteger(args.expectedVersion)||args.expectedVersion<1||!args.payload||typeof args.payload!=='object'||Array.isArray(args.payload))fail();return mutation('update',args);},
  async undo(args={}) {if(!uuid(args.targetOperationId))fail();return mutation('undo',args);},
  async history({ownerId,id}={}) {if(!uuid(id))fail();const rows=await call('history',{ownerId,id});if(!Array.isArray(rows)||rows.length>100)fail();for(const row of rows)if(!uuid(row.operationId)||row.recordId!==id||!['create','update','undo'].includes(row.kind)||!Number.isSafeInteger(row.resultVersion)||row.resultVersion<1||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))fail();return rows.map(row=>({operationId:row.operationId,recordId:row.recordId,kind:row.kind,resultVersion:row.resultVersion,createdAt:row.createdAt,targetOperationId:row.targetOperationId??null}));}
 });
}
