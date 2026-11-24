// Bind reviewed SQL bodies/catalog protections. Never derives a manifest from private record data.
import {createHash} from 'node:crypto';
const f=(args,result,volatility,language='plpgsql',execute=true,names=[],defaults=0)=>({args,result,volatility,language,execute,names,defaults});
const specs={
 'cc_private.common_task_reference_key':f('jsonb,boolean','text','i','plpgsql',true,['p_reference','p_task']),
 'cc_private.common_task_membership_key':f('jsonb,jsonb','text','i','plpgsql',true,['p_task','p_project']),
 'cc_private.common_task_trim':f('text','text','i','sql',true,['v']),
 'cc_private.common_task_endpoint_matches':f('public.cc_records,uuid,jsonb,boolean,boolean','boolean','s','plpgsql',true,['p_row','p_owner','p_reference','p_task','p_history'],1),
 'cc_private.common_task_intrinsic':f('public.cc_records,jsonb,jsonb','boolean','i','sql',true,['p_task_row','p_task','p_project']),
 'cc_private.common_task_membership_matches':f('public.cc_records,public.cc_records,uuid,jsonb,boolean','boolean','s','plpgsql',true,['p_task_row','p_project_row','p_owner','p_payload','p_history'],1),
 'cc_private.restore_new_task_graph':f('','trigger','v','plpgsql',false),
 'cc_private.common_task_link_guard':f('','trigger','v','plpgsql',false),
 'cc_private.common_task_touch_source':f('','trigger','v','plpgsql',false),
 'cc_private.common_task_manual_limit':f('','trigger','v','plpgsql',false),
 'cc_private.common_task_protect_sources':f('','trigger','v','plpgsql',false),
 'cc_private.common_task_recurring_carry_guard':f('','trigger','v','plpgsql',false),
 'public.cc_set_common_task_link':f('jsonb,integer,jsonb,integer,integer,boolean','jsonb','v','plpgsql',true,['p_task','p_task_version','p_project','p_project_version','p_link_version','p_linked']),
 'public.cc_complete_common_recurring_chore':f('uuid,integer,jsonb,date,date,uuid,uuid','jsonb','v','plpgsql',true,['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']),
 'cc_private.validate_project_task_link':f('','trigger','v','plpgsql',false),
 'cc_private.touch_linked_task':f('','trigger','v','plpgsql',false),
 'cc_private.protect_link_targets':f('','trigger','v','plpgsql',false),
 'public.cc_set_task_project_link':f('uuid,integer,uuid,integer,integer,boolean','jsonb','v','plpgsql',true,['p_task_id','p_task_version','p_project_id','p_project_version','p_link_version','p_linked']),
 'public.cc_complete_recurring_chore':f('uuid,integer,jsonb,date,date,uuid,uuid','jsonb','v','plpgsql',true,['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']),
 'cc_private.recurring_chore_day':f('date,text,integer,integer','date','i','plpgsql',true,['anchor','frequency','every_n','ordinal']),
 'cc_private.recurring_chore_plan':f('jsonb,date,date','jsonb','i','plpgsql',true,['schedule','due_day','completed_on']),
 'public.cc_set_project_hierarchy_link':{...f('uuid,integer,uuid,integer,integer,boolean','jsonb','v','plpgsql',true,['p_parent_project_id','p_parent_version','p_child_project_id','p_child_version','p_link_version','p_linked']),optional:true},
 'public.cc_private_school_recovery_ready':f('','boolean','s','sql')
};
const triggers=[['cc_validate_project_task_link','validate_project_task_link',23,false],['cc_touch_linked_task','touch_linked_task',21,false],['cc_protect_link_targets','protect_link_targets',19,false],['cc_common_task_link_guard','common_task_link_guard',31,false],['cc_common_task_touch_source','common_task_touch_source',21,false],['cc_common_task_manual_limit','common_task_manual_limit',23,false],['cc_common_task_protect_sources','common_task_protect_sources',27,false],['cc_common_task_recurring_carry_guard','common_task_recurring_carry_guard',17,true]];
function definitions(sql){if(typeof sql!=='string')throw Error('Reviewed common membership SQL required.');return[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z_]+)\s*\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)].map(m=>({name:m[1],hash:createHash('md5').update(m[2]).digest('hex')}));}
export function commonTaskSchemaManifest({referenceSql,endpointSql,membershipSql,schoolRecoveryReadinessSql,manualMembershipSql,recurrencePlanSql,restoreSql,legacyLockOrderSql}){const recurrence=definitions(recurrencePlanSql);if(recurrence.length!==3)throw Error('Reviewed recurring prerequisites required.');const groups=[definitions(referenceSql),definitions(endpointSql),definitions(membershipSql),definitions(schoolRecoveryReadinessSql),definitions(manualMembershipSql),recurrence.filter(d=>['cc_private.recurring_chore_day','cc_private.recurring_chore_plan'].includes(d.name)),definitions(restoreSql)];if(groups.some((group,i)=>group.length!==[2,4,7,1,5,2,1][i]))throw Error('Complete reviewed membership and prerequisite sources required.');const patches=definitions(legacyLockOrderSql);if(patches.length!==3)throw Error('Reviewed legacy lock-order patch required.');const all=groups.flat().map(d=>patches.find(p=>p.name===d.name)??d);all.push(patches.find(d=>d.name==='public.cc_set_project_hierarchy_link'));if(new Set(all.map(d=>d.name)).size!==23||all.some(d=>!Object.hasOwn(specs,d.name)))throw Error('Exact common membership function set required.');return all.map(d=>({...d,...specs[d.name],signature:d.name+'('+specs[d.name].args+')'}));}
export function commonTaskReadinessSql(sources){const all=commonTaskSchemaManifest(sources),values=all.map(d=>`('${d.signature}','${d.hash}',${d.execute},'${d.result}','${d.volatility}','${d.language}',array[${d.names.map(v=>"'"+v+"'").join(',')}]::text[],${d.defaults},${d.defaults?"'false'":"null"},${!!d.optional})`).join(',\n'),names=all.map(d=>"'"+d.name+"'").join(','),guards=triggers.map(([name,fn,type,deferred])=>`('${name}','cc_private.${fn}()',${type},${deferred})`).join(',\n');return`-- Generated exact source/catalog binding. No record data, secrets or automatic installation.
create function public.cc_private_common_task_links_ready() returns boolean language sql stable security invoker set search_path='' as $$
select coalesce(public.cc_private_school_recovery_ready(),false)
 and not exists(select 1 from(values ${values}) expected(signature,body_hash,authenticated_execute,result_type,volatility,language,arg_names,default_count,defaults,optional)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where (p.oid is null and not expected.optional) or (p.oid is not null and (pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef or p.prokind<>'f'
 or p.proconfig is distinct from array['search_path=""']::text[]
 or p.prorettype<>pg_catalog.to_regtype(expected.result_type) or p.provolatile::text<>expected.volatility
 or p.prolang<>(select oid from pg_catalog.pg_language where lanname=expected.language)
 or coalesce(p.proargnames,array[]::text[]) is distinct from expected.arg_names
 or p.pronargdefaults<>expected.default_count or pg_catalog.pg_get_expr(p.proargdefaults,0) is distinct from expected.defaults
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)))
 and(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in(${names}))=22+case when pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is null then 0 else 1 end
 and not exists(select 1 from(values ${guards}) expected(name,signature,type,deferred)
 left join pg_catalog.pg_trigger t on t.tgrelid='public.cc_records'::regclass and t.tgname=expected.name
 where t.oid is null or t.tgisinternal or t.tgenabled<>'O' or t.tgqual is not null or t.tgattr<>''::int2vector or t.tgnargs<>0
 or t.tgtype<>expected.type or t.tgfoid<>pg_catalog.to_regprocedure(expected.signature)
 or t.tgdeferrable is distinct from expected.deferred or t.tginitdeferred is distinct from expected.deferred
 or (t.tgconstraint<>0) is distinct from expected.deferred)
 and exists(select 1 from pg_catalog.pg_class v where v.oid=pg_catalog.to_regclass('cc_private.restore_new_task_graph') and v.relkind='v'
 and 'security_invoker=true'=any(v.reloptions) and 'security_barrier=true'=any(v.reloptions) and cardinality(v.reloptions)=2
 and pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.pg_get_viewdef(v.oid),'[[:space:]]+',' ','g'))='SELECT NULL::jsonb AS payload WHERE false;'
 and(select count(*) from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum>0 and not a.attisdropped)=1
 and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum=1 and a.attname='payload' and a.atttypid='jsonb'::regtype and not a.attisdropped)
 and(select count(*) from pg_catalog.pg_rewrite r where r.ev_class=v.oid)=1
 and not pg_catalog.has_table_privilege('anon',v.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and pg_catalog.has_table_privilege('authenticated',v.oid,'SELECT') and pg_catalog.has_table_privilege('authenticated',v.oid,'INSERT')
 and not pg_catalog.has_table_privilege('authenticated',v.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and(select count(*) from pg_catalog.pg_trigger t where t.tgrelid=v.oid and not t.tgisinternal)=1
 and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=v.oid and t.tgname='cc_restore_new_task_graph' and not t.tgisinternal
 and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and t.tgtype=69
 and t.tgfoid=pg_catalog.to_regprocedure('cc_private.restore_new_task_graph()') and not t.tgdeferrable and not t.tginitdeferred))
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_private_task_project') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=3 and i.indnatts=3 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='(payload ->> ''taskId''::text), (payload ->> ''projectId''::text)'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''project_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree')
 and i.indclass[2]=i.indclass[1])
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_common_task_pair') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=2 and i.indnatts=2 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='cc_private.common_task_membership_key((payload -> ''task''::text), (payload -> ''project''::text))'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''common_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree'));
$$;
revoke all on function public.cc_private_common_task_links_ready() from public,anon,authenticated;
grant execute on function public.cc_private_common_task_links_ready() to authenticated;
`;}
