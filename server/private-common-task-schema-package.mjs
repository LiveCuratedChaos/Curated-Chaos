// Reproducible, reviewable offline DDL packaging; never executes or installs SQL.
import {commonTaskSchemaManifest,commonTaskReadinessSql} from './private-common-task-schema-readiness.mjs';
function transactionBody(sql){if(typeof sql!=='string'||[...sql.matchAll(/^begin;\s*$/gim)].length!==1||[...sql.matchAll(/^commit;\s*$/gim)].length!==1)throw Error('One reviewed transaction per schema component required.');return sql.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,'').trim();}
export function commonTaskSchemaPackage(sources){
 const manifest=commonTaskSchemaManifest(sources),base=manifest.find(f=>f.name==='public.cc_private_school_recovery_ready'),ready=commonTaskReadinessSql(sources);
 const forward=`-- OFFLINE REVIEW CANDIDATE. Not installed; app/restore/concurrency acceptance remains required.
-- One transaction: preserve existing source records, or roll back every new catalog object.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('${base.signature}') and pg_catalog.md5(prosrc)='${base.hash}' and not prosecdef) then
 raise exception 'Reviewed School recovery prerequisite is not installed';end if;
end$$;
${[sources.legacyLockOrderSql,sources.referenceSql,sources.endpointSql,sources.membershipSql,sources.restoreSql].map(transactionBody).join('\n\n')}
${ready.trim()}
commit;
`;
 const inverse=`-- OFFLINE INVERSE. Refuses retained memberships; no data deletion or CASCADE.
begin;
${[sources.membershipRollbackSql,sources.restoreRollbackSql,sources.legacyLockOrderRollbackSql,sources.endpointRollbackSql,sources.referenceRollbackSql].map(transactionBody).join('\n\n')}
commit;
`;
 return{forward,inverse};
}

// Fixed repository sources only; no configuration, credentials or record access.
export async function loadCommonTaskSchemaSources(){
 const {readFile}=await import('node:fs/promises');
 const files={legacyLockOrderSql:'private_common_task_legacy_lock_order',legacyLockOrderRollbackSql:'private_common_task_legacy_lock_order_rollback',referenceSql:'private_common_task_reference_contract',endpointSql:'private_common_task_endpoints',membershipSql:'private_common_task_memberships',schoolRecoveryReadinessSql:'private_school_academic_recovery_ready',manualMembershipSql:'../migrations/20261116043700_private_project_task_links',recurrencePlanSql:'../migrations/007_reviewed_recurring_chore',restoreSql:'private_task_graph_restore',restoreRollbackSql:'private_task_graph_restore_rollback',membershipRollbackSql:'private_common_task_memberships_rollback',endpointRollbackSql:'private_common_task_endpoints_rollback',referenceRollbackSql:'private_common_task_reference_contract_rollback'};
 return Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await readFile(new URL('../supabase/drafts/'+file+'.sql',import.meta.url),'utf8')])));
}
